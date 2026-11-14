import type { SessionRecord } from "./workspace";
import { topicAccuracy } from "./adaptive";

// ─── Dashboard data builders (pure; rendered with recharts) ───────────────────

export function readinessTrend(
  sessions: SessionRecord[],
): { session: string; score: number; date: string }[] {
  return sessions
    .filter((s) => s.status === "complete" && s.score != null)
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((s, i) => ({
      session: `S${i + 1}`,
      score: s.score as number,
      date: new Date(s.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    }));
}

export function radarData(sessions: SessionRecord[]): { skill: string; score: number }[] {
  const acc = topicAccuracy(sessions);
  const core = ["DSA", "DBMS", "OOP", "Python", "System design", "Behavioral"];
  return core.map((skill) => ({ skill, score: acc.get(skill) ?? 0 }));
}

export type StreakDay = { date: string; count: number; intensity: 0 | 1 | 2 | 3 };

/** Local calendar key (YYYY-MM-DD) — consistent across grid and streak math. */
export function localDayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Last 84 days (12 weeks), oldest first — streak calendar cells. */
export function streakCalendar(sessions: SessionRecord[], now = new Date()): StreakDay[] {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    const d = localDayKey(new Date(s.created_at));
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const days: StreakDay[] = [];
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 83);
  for (let i = 0; i < 84; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = localDayKey(d);
    const count = counts.get(key) ?? 0;
    days.push({
      date: key,
      count,
      intensity: count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3,
    });
  }
  return days;
}

export function currentStreak(sessions: SessionRecord[], now = new Date()): number {
  const days = new Set(sessions.map((s) => localDayKey(new Date(s.created_at))));
  let streak = 0;
  const cursor = new Date(now);
  // Today may not have practice yet — streak counts back from today/yesterday.
  if (!days.has(localDayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(localDayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export type HeatCell = { skill: string; accuracy: number | null; attempts: number };

/** Weak-area heat data: per-skill accuracy (null = untested). */
export function weakAreaHeat(sessions: SessionRecord[]): HeatCell[] {
  const acc = topicAccuracy(sessions);
  const attempts = new Map<string, number>();
  for (const s of sessions)
    for (const r of s.rounds) {
      if (r.assisted) continue;
      attempts.set(r.question.skill, (attempts.get(r.question.skill) ?? 0) + 1);
    }
  return [...attempts.keys()]
    .map((skill) => ({
      skill,
      accuracy: acc.get(skill) ?? null,
      attempts: attempts.get(skill) ?? 0,
    }))
    .sort((a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101));
}

export function heatColor(accuracy: number | null): string {
  if (accuracy == null) return "var(--muted)";
  if (accuracy < 60) return "#c96f4a";
  if (accuracy <= 85) return "#d9b45b";
  return "var(--primary)";
}
