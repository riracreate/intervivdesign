import type { SessionRecord } from "./workspace";

// ─── XP / levels per skill track ──────────────────────────────────────────────
// Effort is rewarded, mastery rewarded more; assisted rounds earn reduced XP
// and (as always) never count toward readiness. Unscored submitted rounds
// (saved code/SQL) earn a small effort award so practice still progresses.

export function xpForRound(score: number, assisted: boolean): number {
  if (assisted) return score > 0 ? Math.round(score * 0.3) : 5;
  return 20 + Math.round(score);
}

/** Cumulative XP needed to *reach* level L (L≥1): 0, 100, 300, 600, 1000… */
export function xpThreshold(level: number): number {
  if (level <= 1) return 0;
  return 100 * ((level * (level - 1)) / 2);
}

export type LevelInfo = {
  level: number;
  xp: number;
  intoLevel: number;
  neededForNext: number;
  progressPct: number;
};

export function levelForXp(xp: number): LevelInfo {
  const safe = Math.max(0, Math.floor(xp));
  let level = 1;
  while (xpThreshold(level + 1) <= safe) level++;
  const floor = xpThreshold(level);
  const ceil = xpThreshold(level + 1);
  return {
    level,
    xp: safe,
    intoLevel: safe - floor,
    neededForNext: ceil - safe,
    progressPct: Math.round(((safe - floor) / (ceil - floor)) * 100),
  };
}

export type TrackProgress = {
  skill: string;
  xp: number;
  level: number;
  progressPct: number;
  rounds: number;
};

export function trackProgress(sessions: SessionRecord[]): TrackProgress[] {
  const bySkill = new Map<string, { xp: number; rounds: number }>();
  for (const s of sessions)
    for (const r of s.rounds) {
      const cur = bySkill.get(r.question.skill) ?? { xp: 0, rounds: 0 };
      cur.xp += xpForRound(r.result.score, r.assisted);
      cur.rounds += 1;
      bySkill.set(r.question.skill, cur);
    }
  return [...bySkill.entries()]
    .map(([skill, v]) => {
      const li = levelForXp(v.xp);
      return { skill, xp: v.xp, level: li.level, progressPct: li.progressPct, rounds: v.rounds };
    })
    .sort((a, b) => b.xp - a.xp);
}

export function totalXp(sessions: SessionRecord[]): LevelInfo {
  const xp = trackProgress(sessions).reduce((a, t) => a + t.xp, 0);
  return levelForXp(xp);
}
