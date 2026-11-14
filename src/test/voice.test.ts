import { describe, it, expect } from "vitest";
import {
  buildFollowUpPrompt,
  parseFollowUpResponse,
  makeVoiceEntry,
  voiceSessionScore,
  formatDuration,
  transcriptWordCount,
} from "@/lib/interviv/voice";
import { questions } from "@/lib/interviv/data";

describe("voice — follow-up prompt & parsing", () => {
  it("builds a prompt containing question, answer and score", () => {
    const q = questions[0]!;
    const p = buildFollowUpPrompt({
      question: q,
      answer: "An index speeds reads",
      transcriptScore: 60,
    });
    expect(p).toContain(q.prompt);
    expect(p).toContain("An index speeds reads");
    expect(p).toContain("60/100");
    expect(p).toContain("ONE concise follow-up");
  });

  it("parses a clean follow-up and falls back on empty input", () => {
    expect(parseFollowUpResponse("  Can you give an example?  ")).toBe("Can you give an example?");
    expect(parseFollowUpResponse("```\nWhat trade-off did you consider?\n```")).toBe(
      "What trade-off did you consider?",
    );
    expect(parseFollowUpResponse("")).toContain("concrete example");
    expect(parseFollowUpResponse("hi")).toContain("concrete example");
  });

  it("truncates overly long follow-ups", () => {
    const long = "Q: " + "x".repeat(400);
    expect(parseFollowUpResponse(long).length).toBeLessThanOrEqual(280);
  });
});

describe("voice — entries & scoring (deterministic rubric preserved)", () => {
  it("scores a spoken answer with the shared evaluate() rubric", () => {
    const q = questions.find((x) => x.id === "index")!;
    const entry = makeVoiceEntry({
      question: q,
      transcript: "An index uses a b-tree to speed read lookups but slows write and uses space",
      askedAt: "2026-01-01T10:00:00.000Z",
      answeredAt: "2026-01-01T10:01:30.000Z",
    });
    expect(entry.score).toBeGreaterThan(50);
    expect(entry.coverage).toBeGreaterThanOrEqual(0);
    expect(entry.durationMs).toBe(90000);
    expect(entry.isFollowUp).toBe(false);
  });

  it("marks follow-ups and computes session average", () => {
    const q = questions[0]!;
    const a = makeVoiceEntry({
      question: q,
      transcript: "index read write",
      askedAt: "2026-01-01T10:00:00.000Z",
      answeredAt: "2026-01-01T10:00:30.000Z",
    });
    const b = makeVoiceEntry({
      question: q,
      transcript: "",
      askedAt: "2026-01-01T10:01:00.000Z",
      answeredAt: "2026-01-01T10:01:10.000Z",
      isFollowUp: true,
      parentQuestionId: q.id,
    });
    expect(b.isFollowUp).toBe(true);
    expect(b.parentQuestionId).toBe(q.id);
    expect(voiceSessionScore([a, b])).toBe(Math.round((a.score + b.score) / 2));
    expect(voiceSessionScore([])).toBeNull();
  });

  it("formats durations and counts words", () => {
    expect(formatDuration(45000)).toBe("45s");
    expect(formatDuration(125000)).toBe("2m 05s");
    expect(formatDuration(null)).toBe("—");
    expect(transcriptWordCount("  hello   world  ")).toBe(2);
    expect(transcriptWordCount("")).toBe(0);
  });
});
