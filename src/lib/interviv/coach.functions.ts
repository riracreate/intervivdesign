import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
export const askCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      message: z.string().min(20).max(8000),
      role: z.string().max(100),
      hours: z.number().min(1).max(40),
    }),
  )
  .handler(async ({ data }) => {
    const { generateResponse } = await import("@lovable.dev/ai-gateway");
    const result = await generateResponse({
      model: "openai/gpt-6-astra",
      input: `You are InterViv, a warm, precise interview preparation coach. User goal or job description: ${data.message}\nTarget role: ${data.role}. Weekly study hours: ${data.hours}. Provide a concise actionable plan with skills to focus on and 3 specific tasks. Do not invent readiness scores, prior results or credentials. Never claim to run code. Keep under 350 words.`,
      max_output_tokens: 1600,
    });
    const text = result.output
      .flatMap((item) =>
        item.type === "message"
          ? item.content.filter((c) => c.type === "output_text").map((c) => c.text)
          : [],
      )
      .join("\n");
    return { text };
  });
