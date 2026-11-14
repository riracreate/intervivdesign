import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { skills as knownSkills } from "./data";
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
    const extractSkills = (source: string) => {
      const lower = source.toLowerCase();
      const matched = knownSkills.filter((s) => lower.includes(s.toLowerCase()));
      if (matched.length >= 2) return matched.slice(0, 4);
      if (/system design|scale|architecture/i.test(source)) return ["System design", "DBMS", "DSA"];
      if (/sql|database|dbms/i.test(source)) return ["DBMS", "SQL", "DSA"];
      if (/frontend|react|ui/i.test(source)) return ["React", "TypeScript", "JavaScript"];
      return ["DSA", "DBMS", "System design", "Behavioral"];
    };

    const extractTasks = (text: string, focusSkills: string[]) => {
      const numbered = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^\d+[.)]\s+/.test(l))
        .map((l) => l.replace(/^\d+[.)]\s+/, "").trim())
        .slice(0, 4);
      if (numbered.length >= 2) return numbered;
      return [
        `Complete one focused ${focusSkills[0] ?? "DSA"} practice session and review missing concepts.`,
        `Practice ${focusSkills[1] ?? "DBMS"} with concrete examples and trade-offs.`,
        `Run a timed Assessment round to establish an unassisted baseline.`,
      ];
    };

    const buildFallbackPlan = () => {
      const focusSkills = extractSkills(data.message);
      const tasks = [
        `Start a 15-minute ${focusSkills[0] ?? "DSA"} practice session in Practice and explain your reasoning before submitting.`,
        `Review ${focusSkills[1] ?? "DBMS"} in Gap Analysis and bookmark 2 targeted refreshers in the Learning Library.`,
        `Finish the week with one timed Assessment round (${Math.max(1, Math.round(data.hours / 3))} hrs total review) to establish an unassisted baseline.`,
      ];
      return {
        text: [
          `Here is a focused ${data.hours}-hour/week plan for your ${data.role || "Software Engineer"} preparation:`,
          "",
          `Key areas to prioritize: ${focusSkills.join(", ")}.`,
          "",
          "3 concrete next steps:",
          ...tasks.map((t, i) => `${i + 1}. ${t}`),
        ].join("\n"),
        plan: {
          summary: `${data.hours} hrs/week plan for ${data.role || "Software Engineer"}`,
          focusSkills,
          tasks,
          updatedAt: new Date().toISOString(),
        },
      };
    };

    if (!process.env["LOVABLE_API_KEY"]) {
      return buildFallbackPlan();
    }

    try {
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
      if (!text) return buildFallbackPlan();
      const focusSkills = extractSkills(`${data.message}\n${text}`);
      return {
        text,
        plan: {
          summary: `${data.hours} hrs/week coach plan for ${data.role || "Software Engineer"}`,
          focusSkills,
          tasks: extractTasks(text, focusSkills),
          updatedAt: new Date().toISOString(),
        },
      };
    } catch {
      return buildFallbackPlan();
    }
  });
