import { describe, it, expect } from "vitest";
import {
  initialState,
  sm2Update,
  qualityFromScore,
  isDue,
  dueTopics,
  ensureStates,
} from "@/lib/interviv/spaced-repetition";

const NOW = new Date("2026-06-01T09:00:00.000Z");

describe("SM-2 scheduler", () => {
  it("starts at ease 2.5, due immediately", () => {
    const s = initialState("DBMS", NOW);
    expect(s.easeFactor).toBe(2.5);
    expect(s.intervalDays).toBe(0);
    expect(isDue(s, NOW)).toBe(true);
  });

  it("follows 1d → 6d → ×ease with perfect grades", () => {
    let s = initialState("DSA", NOW);
    s = sm2Update(s, 5, NOW);
    expect(s).toMatchObject({ repetitions: 1, intervalDays: 1, easeFactor: 2.6 });
    expect(s.nextDue).toBe("2026-06-02T09:00:00.000Z");
    s = sm2Update(s, 5, new Date(s.nextDue));
    expect(s).toMatchObject({ repetitions: 2, intervalDays: 6, easeFactor: 2.7 });
    s = sm2Update(s, 5, new Date(s.nextDue));
    // I(3) = round(6 × 2.8) with EF after third perfect grade = 2.8
    expect(s.intervalDays).toBe(Math.round(6 * s.easeFactor));
    expect(s.repetitions).toBe(3);
  });

  it("resets on quality < 3 and floors ease at 1.3", () => {
    let s = initialState("OOP", NOW);
    s = sm2Update(s, 5, NOW);
    s = sm2Update(s, 2, NOW);
    expect(s.repetitions).toBe(0);
    expect(s.intervalDays).toBe(1);
    // EF: 2.6 + (0.1 − 3×(0.08+3×0.02)) = 2.6 − 0.32
    expect(s.easeFactor).toBe(2.28);
    let f = initialState("SQL", NOW);
    for (let i = 0; i < 6; i++) f = sm2Update(f, 0, NOW);
    expect(f.easeFactor).toBe(1.3);
  });

  it("keeps ease steady at quality 4 and rejects bad grades", () => {
    const s = sm2Update(initialState("Python", NOW), 4, NOW);
    expect(s.easeFactor).toBe(2.5);
    expect(() => sm2Update(s, 6, NOW)).toThrow();
    expect(() => sm2Update(s, -1, NOW)).toThrow();
  });

  it("maps scores to grades and lists due-today soonest first", () => {
    expect(qualityFromScore(95)).toBe(5);
    expect(qualityFromScore(60)).toBe(3);
    expect(qualityFromScore(10)).toBe(0);
    const a = { ...initialState("A", NOW), nextDue: "2026-06-01T08:00:00.000Z" };
    const b = { ...initialState("B", NOW), nextDue: "2026-06-05T08:00:00.000Z" };
    const c = { ...initialState("C", NOW), nextDue: "2026-05-30T08:00:00.000Z" };
    expect(dueTopics([a, b, c], NOW).map((s) => s.topic)).toEqual(["C", "A"]);
    expect(
      ensureStates(["A", "D"], [a], NOW)
        .map((s) => s.topic)
        .sort(),
    ).toEqual(["A", "D"]);
  });
});
