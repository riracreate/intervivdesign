import { questions, skills, type Question } from "./data";
import type { SessionRecord } from "./workspace";

// ─── Adaptive difficulty from per-topic accuracy ──────────────────────────────
// <60% → easier · 60–85% → steady · >85% → harder. Boundaries are exclusive
// exactly as specified: 60 is steady, 85 is steady.

export type DifficultyBand = "easier" | "steady" | "harder";

export function difficultyForAccuracy(accuracyPct: number | null): DifficultyBand {
  if (accuracyPct == null || !Number.isFinite(accuracyPct)) return "steady";
  if (accuracyPct < 60) return "easier";
  if (accuracyPct > 85) return "harder";
  return "steady";
}

/** Per-skill accuracy (%) from unassisted rounds only — assisted/unexecuted excluded. */
export function topicAccuracy(sessions: SessionRecord[]): Map<string, number> {
  const sums = new Map<string, { total: number; n: number }>();
  for (const s of sessions)
    for (const r of s.rounds) {
      if (r.assisted) continue;
      const cur = sums.get(r.question.skill) ?? { total: 0, n: 0 };
      cur.total += r.result.score;
      cur.n += 1;
      sums.set(r.question.skill, cur);
    }
  const out = new Map<string, number>();
  for (const [skill, v] of sums) out.set(skill, Math.round(v.total / v.n));
  return out;
}

const SEVEN_DAYS_MS = 7 * 86_400_000;

/**
 * Difficulty proxy within the fixed bank: fewer target concepts = gentler
 * question, more concepts = deeper question. Disclosed, deterministic.
 */
export function questionLoad(q: Question): number {
  return q.concepts.length * 10 + Math.round(q.prompt.length / 40);
}

/**
 * Pick `count` questions for a skill: honor the difficulty band and never
 * repeat a question seen within 7 days (unless the fresh pool runs out, in
 * which case the least-recently-seen come back first).
 */
export function selectAdaptive(params: {
  skill: string;
  accuracyPct: number | null;
  lastSeenById: Map<string, number>;
  nowMs: number;
  count: number;
  bank?: Question[];
}): Question[] {
  const bank = (params.bank ?? questions).filter((q) => q.skill === params.skill && !q.type);
  const band = difficultyForAccuracy(params.accuracyPct);
  const sorted = [...bank].sort((a, b) =>
    band === "harder" ? questionLoad(b) - questionLoad(a) : questionLoad(a) - questionLoad(b),
  );
  const fresh = sorted.filter((q) => {
    const seen = params.lastSeenById.get(q.id);
    return seen == null || params.nowMs - seen >= SEVEN_DAYS_MS;
  });
  const picked = fresh.slice(0, params.count);
  if (picked.length < params.count) {
    const rest = sorted
      .filter((q) => !picked.includes(q))
      .sort((a, b) => (params.lastSeenById.get(a.id) ?? 0) - (params.lastSeenById.get(b.id) ?? 0));
    picked.push(...rest.slice(0, params.count - picked.length));
  }
  return picked;
}

/** Last-seen map from session history (question base id → latest epoch ms). */
export function lastSeenFromSessions(sessions: SessionRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sessions) {
    const t = new Date(s.created_at).getTime();
    for (const r of s.rounds) {
      const base = r.question.id
        .replace(/-\d+$/, "")
        .replace(/-followup.*$/, "")
        .replace(/-viv-followup$/, "");
      map.set(base, Math.max(map.get(base) ?? 0, t));
      map.set(r.question.id, Math.max(map.get(r.question.id) ?? 0, t));
    }
  }
  return map;
}

// ─── Resume + job-description parser (deterministic, disclosed) ───────────────
// Keyword/concept matching only — the same disclosed approach as evaluate().
// No NLP/ML claim: it finds explicit skill mentions and concept stems.

function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9+#. ]+/g, " ")} `;
}

export function extractSkills(text: string): string[] {
  const hay = normalize(text);
  return skills.filter((s) => {
    const needle = s.toLowerCase();
    // Multi-word skills match as phrases; single tokens match as whole words.
    return hay.includes(` ${needle} `) || hay.includes(` ${needle},`) || hay.includes(needle);
  });
}

export type ParsedPlan = {
  resumeSkills: string[];
  jdSkills: string[];
  matched: string[];
  gaps: string[];
  questionSet: Question[];
};

export function parseResumeAndJD(resumeText: string, jdText: string, count = 5): ParsedPlan {
  const resumeSkills = extractSkills(resumeText);
  const jdSkills = extractSkills(jdText);
  const resumeSet = new Set(resumeSkills);
  const matched = jdSkills.filter((s) => resumeSet.has(s));
  const gaps = jdSkills.filter((s) => !resumeSet.has(s));
  // Role-specific set: gap skills first (what the role needs that the resume
  // doesn't show), then matched skills to verify depth. No repeats.
  const orderedSkills = [...gaps, ...matched];
  const pool = questions.filter((q) => !q.type && orderedSkills.includes(q.skill));
  const seen = new Set<string>();
  const questionSet: Question[] = [];
  for (const skill of orderedSkills) {
    for (const q of pool.filter((x) => x.skill === skill)) {
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      questionSet.push(q);
      if (questionSet.length >= count) break;
    }
    if (questionSet.length >= count) break;
  }
  return { resumeSkills, jdSkills, matched, gaps, questionSet };
}
