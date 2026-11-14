import { evaluate, type Question } from "./data";

// ─── Per-question rubric: clarity · structure · depth · relevance ─────────────
// Deterministic and disclosed, layered on evaluate() without changing it.
// Each dimension is 0–10; the overall is the equal-weight mean (×10 → 0–100).

export type RubricScores = {
  clarity: number;
  structure: number;
  depth: number;
  relevance: number;
};

export const RUBRIC_WEIGHTS: Record<keyof RubricScores, number> = {
  clarity: 0.25,
  structure: 0.25,
  depth: 0.25,
  relevance: 0.25,
};

export const RUBRIC_GUIDE: { key: keyof RubricScores; label: string; looksFor: string }[] = [
  {
    key: "clarity",
    label: "Clarity",
    looksFor: "Plain sentences, one idea at a time, a concrete example, trade-offs named out loud.",
  },
  {
    key: "structure",
    label: "Structure",
    looksFor:
      "A visible arc: opening point → reasoning steps (first / then / because) → example → result or takeaway.",
  },
  {
    key: "depth",
    label: "Depth",
    looksFor:
      "Enough detail to prove understanding: mechanisms, numbers, edge cases — not just definitions.",
  },
  {
    key: "relevance",
    label: "Relevance",
    looksFor:
      "Answers the question asked: covers its target concepts and stays on the prompt's terms.",
  },
];

const STRUCTURE_MARKERS = [
  "first",
  "then",
  "because",
  "however",
  "for example",
  "example",
  "result",
  "finally",
  "in summary",
  "trade-off",
  "tradeoff",
];

export function structureScore(answer: string): number {
  const text = answer.toLowerCase();
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  if (words < 8) return 2;
  let hits = 0;
  for (const m of STRUCTURE_MARKERS) if (text.includes(m)) hits++;
  const breaks = (answer.match(/\n\s*\n|\n[A-Z]/g) ?? []).length > 0 ? 1 : 0;
  const star = ["situation", "task", "action", "result"].filter((w) => text.includes(w)).length;
  return Math.max(0, Math.min(10, 2 + hits + breaks + Math.floor(star / 2)));
}

function promptOverlap(question: Question, answer: string): number {
  const stop = new Set([
    "what",
    "when",
    "would",
    "choose",
    "explain",
    "describe",
    "about",
    "using",
    "using",
    "with",
    "does",
    "your",
    "give",
  ]);
  const promptWords = [...new Set(question.prompt.toLowerCase().match(/[a-z]{4,}/g) ?? [])].filter(
    (w) => !stop.has(w),
  );
  if (!promptWords.length) return 0;
  const text = answer.toLowerCase();
  const hit = promptWords.filter((w) => text.includes(w)).length;
  return hit / promptWords.length; // 0..1
}

export function scoreRubric(
  question: Question,
  answer: string,
): RubricScores & { overall: number } {
  const base = evaluate(question, answer, null);
  const clarity = base.clarity;
  const structure = question.type === "mcq" ? 10 : structureScore(answer);
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const depthBonus =
    answer.toLowerCase().includes("because") || answer.toLowerCase().includes("trade") ? 1 : 0;
  const depth =
    question.type === "mcq"
      ? base.depth
      : Math.min(10, base.depth + (words >= 60 ? depthBonus : 0));
  const relevance =
    question.type === "mcq"
      ? base.correctness
      : Math.round(base.coverage * 0.7 + promptOverlap(question, answer) * 10 * 0.3);
  const overall = Math.round(
    (clarity * RUBRIC_WEIGHTS.clarity +
      structure * RUBRIC_WEIGHTS.structure +
      depth * RUBRIC_WEIGHTS.depth +
      relevance * RUBRIC_WEIGHTS.relevance) *
      10,
  );
  return { clarity, structure, depth, relevance: Math.max(0, Math.min(10, relevance)), overall };
}
