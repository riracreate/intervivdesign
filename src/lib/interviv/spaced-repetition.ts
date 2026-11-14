// ─── Spaced repetition ────────────────────────────────────────────────────────
// Two complementary systems live here:
// 1. Per-question review ladder (stages on a 1/3/7/16/35-day ladder) — powers
//    the /learn review queue and the home "due now" count.
// 2. Per-topic SM-2 (Wozniak, quality 0–5, ease factor) — powers the /adaptive
//    hub and the home "Due today" topic list. Mirrors the `spaced_repetition`
//    Drizzle table (next_due, interval_days, ease_factor).
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

// ─── SM-2 spaced repetition (per topic) ───────────────────────────────────────
// Classic SM-2 (Wozniak): quality 0–5 grades each review.

export type SpacedState = {
  topic: string;
  /** ISO timestamp when this topic is next due */
  nextDue: string;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lastQuality: number | null;
  lastReviewedAt: string | null;
};

export const INITIAL_EASE = 2.5;
export const MIN_EASE = 1.3;

export function initialState(topic: string, now = new Date()): SpacedState {
  return {
    topic,
    nextDue: now.toISOString(),
    intervalDays: 0,
    easeFactor: INITIAL_EASE,
    repetitions: 0,
    lastQuality: null,
    lastReviewedAt: null,
  };
}

/** Map the disclosed 0–100 deterministic score to an SM-2 grade 0–5. */
export function qualityFromScore(score: number): number {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  if (score >= 20) return 1;
  return 0;
}

export function validateQuality(q: number): number {
  if (!Number.isFinite(q) || q < 0 || q > 5) throw new Error("SM-2 quality must be 0–5.");
  return Math.round(q);
}

/**
 * One SM-2 review. Pure: returns the next state, never mutates the input.
 * - quality < 3: repetitions reset, relearn in 1 day.
 * - intervals: 1 day, then 6 days, then previous × ease factor.
 * - ease: EF + (0.1 − (5−q)·(0.08 + (5−q)·0.02)), floored at 1.3.
 */
export function sm2Update(state: SpacedState, qualityInput: number, now = new Date()): SpacedState {
  const quality = validateQuality(qualityInput);
  const easeFactor = Math.max(
    MIN_EASE,
    state.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );
  let repetitions: number;
  let intervalDays: number;
  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions = state.repetitions + 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.max(1, Math.round(state.intervalDays * easeFactor));
  }
  const nextDue = new Date(now.getTime() + intervalDays * 86_400_000);
  return {
    topic: state.topic,
    nextDue: nextDue.toISOString(),
    intervalDays,
    easeFactor: Math.round(easeFactor * 100) / 100,
    repetitions,
    lastQuality: quality,
    lastReviewedAt: now.toISOString(),
  };
}

export function isDue(state: SpacedState, now = new Date()): boolean {
  return new Date(state.nextDue).getTime() <= now.getTime();
}

/** Due now or overdue, soonest first. “Due today” = due by end of today. */
export function dueTopics(states: SpacedState[], now = new Date()): SpacedState[] {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  return states
    .filter((s) => new Date(s.nextDue).getTime() <= endOfToday.getTime())
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue));
}

/** Seed states for topics the learner has practiced but never scheduled. */
export function ensureStates(
  topics: string[],
  existing: SpacedState[],
  now = new Date(),
): SpacedState[] {
  const byTopic = new Map(existing.map((s) => [s.topic, s]));
  for (const t of topics) if (!byTopic.has(t)) byTopic.set(t, initialState(t, now));
  return [...byTopic.values()];
}
