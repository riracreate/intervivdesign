import { describe, it, expect } from "vitest";
import { scoreRubric, RUBRIC_WEIGHTS, structureScore } from "@/lib/interviv/rubric";
import {
  analyzeCommunication,
  countFillers,
  detectPauses,
  paceLabel,
} from "@/lib/interviv/communication";
import { xpForRound, levelForXp, xpThreshold } from "@/lib/interviv/xp";
import { readinessTrend, streakCalendar } from "@/lib/interviv/analytics";
import { encodeReportCard, decodeReportCard } from "@/lib/interviv/share";
import { evaluate, questions, type Question } from "@/lib/interviv/data";
import type { SessionRecord } from "@/lib/interviv/workspace";

describe("rubric — clarity/structure/depth/relevance, equal weights", () => {
  it("weights sum to 1 and overall is their mean ×10", () => {
    const sum = Object.values(RUBRIC_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
    const q = questions.find((x) => x.id === "index")!;
    const r = scoreRubric(
      q,
      "An index uses a b-tree. First it speeds read lookups, then writes pay maintenance. For example a lookup skips full scans, however space grows, so the trade-off matters for write-heavy tables with example cases and result checks.",
    );
    const expected = Math.round(((r.clarity + r.structure + r.depth + r.relevance) / 4) * 10);
    expect(r.overall).toBe(expected);
    for (const v of [r.clarity, r.structure, r.depth, r.relevance]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  it("rewards structure markers and stays deterministic", () => {
    const plain = structureScore("indexes are fast and good for databases overall yes");
    const structured = structureScore(
      "First, an index speeds reads. Then writes slow down because the tree updates. For example, lookups skip scans. Finally, the result is a clear trade-off.",
    );
    expect(structured).toBeGreaterThan(plain);
    const q = questions[0]!;
    expect(scoreRubric(q, "atomic transfer example")).toEqual(
      scoreRubric(q, "atomic transfer example"),
    );
  });
});

describe("scoring weights — disclosed evaluate() formula preserved", () => {
  it("score = round(((coverage×2 + depth + clarity) / 4) × 10)", () => {
    const q = questions.find((x) => x.id === "index")! as Question;
    const r = evaluate(q, "index read write b-tree space example trade", null);
    expect(r.score).toBe(Math.round(((r.coverage * 2 + r.depth + r.clarity) / 4) * 10));
    expect(evaluate(q, "", null).score).toBeLessThan(r.score);
  });
});

describe("communication analytics", () => {
  it("counts fillers, WPM and gaps honestly", () => {
    expect(countFillers("Um, I, uh, basically solved it, you know").total).toBe(4);
    const stats = analyzeCommunication({
      transcript: "one two three four five six",
      durationMs: 3000,
    });
    expect(stats.words).toBe(6);
    expect(stats.wordsPerMinute).toBe(120);
    expect(paceLabel(stats.wordsPerMinute)).toBe("Conversational pace");
    // No duration → no invented pace
    expect(analyzeCommunication({ transcript: "hello world" }).wordsPerMinute).toBeNull();
  });

  it("detects pauses ≥600ms between timed words", () => {
    const pauses = detectPauses([
      { word: "hello", startMs: 0, endMs: 300 },
      { word: "world", startMs: 400, endMs: 700 },
      { word: "again", startMs: 1600, endMs: 1900 },
    ]);
    expect(pauses).toHaveLength(1);
    expect(pauses[0]!.gapMs).toBe(900);
  });
});

describe("XP & levels per track", () => {
  it("rewards unassisted mastery most, assisted least", () => {
    expect(xpForRound(100, false)).toBe(120);
    expect(xpForRound(100, true)).toBe(30);
    expect(xpForRound(0, true)).toBe(5);
    expect(xpThreshold(2)).toBe(100);
    expect(xpThreshold(3)).toBe(300);
    expect(levelForXp(0).level).toBe(1);
    expect(levelForXp(100).level).toBe(2);
    expect(levelForXp(299).level).toBe(2);
    expect(levelForXp(300).level).toBe(3);
    expect(levelForXp(150).progressPct).toBe(25);
  });
});

describe("dashboards data & shareable card", () => {
  const session = (id: string, score: number, date: string): SessionRecord => ({
    id,
    title: "Mock interview",
    mode: "interview",
    skills: ["DBMS"],
    rounds: [],
    status: "complete",
    score,
    assisted: false,
    created_at: date,
    draft: {},
  });

  it("builds a chronological readiness trend and 84-day streak grid", () => {
    const sessions = [
      session("b", 80, "2026-06-02T10:00:00.000Z"),
      session("a", 60, "2026-06-01T10:00:00.000Z"),
    ];
    expect(readinessTrend(sessions).map((d) => d.score)).toEqual([60, 80]);
    const grid = streakCalendar(sessions, new Date("2026-06-02T12:00:00.000Z"));
    expect(grid).toHaveLength(84);
    expect(grid.filter((d) => d.count > 0)).toHaveLength(2);
  });

  it("round-trips a card and rejects tampered payloads", () => {
    const card = {
      v: 1 as const,
      title: "Mock interview",
      score: 82,
      skills: ["DBMS", "DSA"],
      rounds: 6,
      date: "2 Jun 2026",
      level: 3,
      xp: 340,
      topSkill: "DBMS",
    };
    const code = encodeReportCard(card);
    expect(decodeReportCard(code)).toEqual(card);
    expect(decodeReportCard("not-a-card!!!")).toBeNull();
    expect(decodeReportCard(undefined)).toBeNull();
  });
});
