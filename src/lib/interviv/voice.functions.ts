import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { buildFollowUpPrompt, parseFollowUpResponse } from "./voice";
import type { Question } from "./data";

const FollowUpInput = z.object({
  question: z.object({
    id: z.string().max(120),
    skill: z.string().max(80),
    prompt: z.string().min(1).max(2000),
    concepts: z.array(z.string().max(80)).max(20),
    hint: z.string().max(500).default(""),
  }),
  answer: z.string().max(8000),
  score: z.number().min(0).max(100),
});

/**
 * AI adaptive follow-up — authenticated server function via Lovable AI Gateway.
 * The model only generates the next question; scoring stays deterministic
 * (see `evaluate` in data.ts). No prompts or keys reach the browser.
 */
export const generateFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(FollowUpInput)
  .handler(async ({ data }) => {
    const q: Question = {
      id: data.question.id,
      skill: data.question.skill,
      prompt: data.question.prompt,
      concepts: data.question.concepts,
      hint: data.question.hint,
    };
    const prompt = buildFollowUpPrompt({
      question: q,
      answer: data.answer,
      transcriptScore: data.score,
    });
    const { generateResponse } = await import("@lovable.dev/ai-gateway");
    const result = await generateResponse({
      model: "openai/gpt-6-astra",
      input: prompt,
      max_output_tokens: 220,
    });
    const raw = result.output
      .flatMap((item) =>
        item.type === "message"
          ? item.content.filter((c) => c.type === "output_text").map((c) => c.text)
          : [],
      )
      .join("\n");
    const followUp = parseFollowUpResponse(raw);
    return { followUp };
  });
