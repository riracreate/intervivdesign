import { describe, it, expect } from "vitest";
import {
  difficultyForAccuracy,
  selectAdaptive,
  parseResumeAndJD,
  extractSkills,
} from "@/lib/interviv/adaptive";
import { questions } from "@/lib/interviv/data";

describe("adaptive difficulty thresholds (<60 easier, >85 harder)", () => {
  it("respects exact boundaries", () => {
    expect(difficultyForAccuracy(59)).toBe("easier");
    expect(difficultyForAccuracy(60)).toBe("steady");
    expect(difficultyForAccuracy(85)).toBe("steady");
    expect(difficultyForAccuracy(86)).toBe("harder");
    expect(difficultyForAccuracy(null)).toBe("steady");
  });

  it("never repeats within 7 days while fresh questions remain", () => {
    const now = Date.now();
    const dbms = questions.filter((q) => q.skill === "DBMS" && !q.type);
    expect(dbms.length).toBeGreaterThanOrEqual(2);
    const seenRecently = new Map([[dbms[0]!.id, now - 2 * 86_400_000]]);
    const picked = selectAdaptive({
      skill: "DBMS",
      accuracyPct: 70,
      lastSeenById: seenRecently,
      nowMs: now,
      count: 1,
    });
    expect(picked[0]!.id).not.toBe(dbms[0]!.id);
    // Seen 8 days ago → eligible again
    const seenLongAgo = new Map([[dbms[0]!.id, now - 8 * 86_400_000]]);
    const picked2 = selectAdaptive({
      skill: "DBMS",
      accuracyPct: 70,
      lastSeenById: seenLongAgo,
      nowMs: now,
      count: 2,
    });
    expect(picked2.map((q) => q.id)).toContain(dbms[0]!.id);
  });
});

describe("resume + JD parser (deterministic matching)", () => {
  it("extracts skills and puts gaps first in the question set", () => {
    expect(extractSkills("Strong Python and SQL, some React")).toEqual(
      expect.arrayContaining(["Python", "SQL", "React"]),
    );
    const plan = parseResumeAndJD(
      "Engineer skilled in Python and DSA. Built data pipelines.",
      "Hiring Software Engineer: Python, DBMS, System design required. DSA a plus.",
      5,
    );
    expect(plan.jdSkills).toEqual(
      expect.arrayContaining(["Python", "DBMS", "System design", "DSA"]),
    );
    expect(plan.matched).toContain("Python");
    expect(plan.gaps).toContain("DBMS");
    expect(plan.questionSet.length).toBeGreaterThan(0);
    // First question targets a gap skill, not a matched one
    expect(plan.gaps).toContain(plan.questionSet[0]!.skill);
    const ids = plan.questionSet.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns an empty set when nothing matches", () => {
    const plan = parseResumeAndJD(
      "Cooking and gardening enthusiast.",
      "Pastry chef needed for bakery.",
      5,
    );
    expect(plan.questionSet).toEqual([]);
  });
});
