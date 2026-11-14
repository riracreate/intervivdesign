import { nextReview, questions, type Question } from "./data";

export type ReviewEntry = {
  questionId: string;
  skill: string;
  prompt: string;
  hint: string;
  stage: number;
  lastScore: number;
  attempts: number;
  nextReviewAt: string;
  updatedAt: string;
};

export const extendedQuestions: Question[] = questions;

export function stripRoundSuffix(questionId: string) {
  return questionId.replace(/-\d+$/, "");
}

export function scheduleReviewItem(
  existing: ReviewEntry | undefined,
  question: Pick<Question, "id" | "skill" | "prompt" | "hint">,
  score: number,
  nowMs = Date.now(),
): ReviewEntry {
  const baseId = stripRoundSuffix(question.id);
  const passed = score >= 70;
  const currentStage = existing?.stage ?? 0;
  const nextDays = nextReview(passed, currentStage);
  const nextStage = passed ? Math.min(currentStage + 1, 4) : 0;
  return {
    questionId: baseId,
    skill: question.skill,
    prompt: question.prompt,
    hint: question.hint,
    stage: nextStage,
    lastScore: score,
    attempts: (existing?.attempts ?? 0) + 1,
    nextReviewAt: new Date(nowMs + nextDays * 86_400_000).toISOString(),
    updatedAt: new Date(nowMs).toISOString(),
  };
}

export function partitionReviews(entries: ReviewEntry[], nowMs = Date.now()) {
  const due: ReviewEntry[] = [];
  const upcoming: ReviewEntry[] = [];
  for (const item of entries) {
    const ts = Date.parse(item.nextReviewAt);
    if (Number.isNaN(ts) || ts <= nowMs) due.push(item);
    else upcoming.push(item);
  }
  due.sort((a, b) => Date.parse(a.nextReviewAt) - Date.parse(b.nextReviewAt));
  upcoming.sort((a, b) => Date.parse(a.nextReviewAt) - Date.parse(b.nextReviewAt));
  return { due, upcoming };
}

export function getEffectiveReviewSchedule(saved?: ReviewEntry[] | null): ReviewEntry[] {
  if (saved && saved.length > 0) return saved;
  const nowIso = new Date().toISOString();
  return questions
    .filter((q) => !q.type)
    .slice(0, 4)
    .map((q) => ({
      questionId: q.id,
      skill: q.skill,
      prompt: q.prompt,
      hint: q.hint,
      stage: 0,
      lastScore: 0,
      attempts: 0,
      nextReviewAt: nowIso,
      updatedAt: nowIso,
    }));
}

export function formatRelativeReview(isoDate: string, nowMs = Date.now()): string {
  const diffMs = Date.parse(isoDate) - nowMs;
  if (Number.isNaN(diffMs) || diffMs <= 0) return "Due now";
  const days = Math.ceil(diffMs / 86_400_000);
  return days === 1 ? "Due in 1 day" : `Due in ${days} days`;
}
