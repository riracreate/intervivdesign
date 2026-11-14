import { describe, it, expect } from "vitest";
import {
  validPassword,
  nextReview,
  gapSeverity,
  makeQuestions,
  evaluate,
  questions,
} from "@/lib/interviv/data";
describe("InterViv rules", () => {
  it("requires 8 characters including a letter and a number", () => {
    expect(validPassword("abc12345")).toBe(true);
    expect(validPassword("abc1234")).toBe(false);
    expect(validPassword("abcdefgh")).toBe(false);
    expect(validPassword("12345678")).toBe(false);
  });
  it("uses 1,3,7,16,35 day review ladder and resets misses", () => {
    expect([0, 1, 2, 3, 4].map((s) => nextReview(true, s))).toEqual([3, 7, 16, 35, 35]);
    expect(nextReview(false, 4)).toBe(1);
  });
  it("classifies gaps at concrete boundaries", () => {
    expect(gapSeverity(26, 3)).toBe("High");
    expect(gapSeverity(25, 3)).toBe("Medium");
    expect(gapSeverity(11, 3)).toBe("Medium");
    expect(gapSeverity(10, 3)).toBe("Low");
    expect(gapSeverity(70, 0)).toBe("Untested");
  });
  it("creates the requested number of rounds", () => {
    expect(makeQuestions("full", ["DBMS", "DSA"], 6)).toHaveLength(6);
  });
  it("grades MCQ exact options", () => {
    const q = questions.find((q) => q.id === "oa1");
    if (!q) throw new Error("Missing OA question");
    expect(evaluate(q, "", 0).score).toBe(100);
    expect(evaluate(q, "", 1).score).toBe(0);
  });
});
