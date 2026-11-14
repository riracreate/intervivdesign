import { describe, it, expect } from "vitest";
import {
  thinkingPauseMs,
  gazeTargetAt,
  gazeRotation,
  breathingScale,
  mouthOpenAt,
  poseForPhase,
  talkingAvatarStatus,
  appearanceConfig,
  INTERRUPT_BUDGET_MS,
  THINKING_MIN_MS,
  THINKING_MAX_MS,
} from "@/lib/interviv/avatar";

describe("avatar — thinking pause (1–2s before follow-ups)", () => {
  it("stays within 1000–2000ms for any rand", () => {
    expect(thinkingPauseMs(0)).toBe(THINKING_MIN_MS);
    expect(thinkingPauseMs(0.9999)).toBeLessThanOrEqual(THINKING_MAX_MS);
    expect(thinkingPauseMs(0.5)).toBe(1500);
    for (const r of [0.1, 0.33, 0.77]) {
      const ms = thinkingPauseMs(r);
      expect(ms).toBeGreaterThanOrEqual(1000);
      expect(ms).toBeLessThanOrEqual(2000);
    }
  });
});

describe("avatar — gaze, breathing, lip-sync envelopes", () => {
  it("looks down while thinking and breaks gaze periodically", () => {
    expect(gazeTargetAt(1000, "thinking")).toBe("down");
    expect(gazeTargetAt(1000, "speaking")).toBe("camera");
    expect(gazeTargetAt(6500, "idle")).toBe("side");
    expect(gazeTargetAt(7100, "idle")).toBe("camera");
    expect(gazeRotation("down").x).toBeGreaterThan(gazeRotation("camera").x);
  });

  it("breathes subtly and opens mouth only while speaking", () => {
    const b = [0, 1000, 2000, 3000].map((t) => breathingScale(t, "idle"));
    expect(Math.max(...b) - Math.min(...b)).toBeGreaterThan(0.01);
    expect(Math.max(...b)).toBeLessThanOrEqual(1.02);
    expect(mouthOpenAt(100, "listening")).toBeLessThan(0.1);
    const speaking = [0, 120, 240, 400, 700].map((t) => mouthOpenAt(t, "speaking"));
    expect(Math.max(...speaking)).toBeGreaterThan(0.4);
    expect(speaking.every((v) => v >= 0 && v <= 1)).toBe(true);
  });

  it("maps phases to poses and TalkingAvatar status", () => {
    expect(poseForPhase("asking")).toBe("speaking");
    expect(poseForPhase("thinking")).toBe("thinking");
    expect(poseForPhase("listening")).toBe("listening");
    expect(talkingAvatarStatus("thinking")).toBe("thinking");
    expect(talkingAvatarStatus("speaking")).toBe("listening");
  });
});

describe("avatar — appearance picker & interrupt budget", () => {
  it("offers male / female / voice-only with stage only for 3D modes", () => {
    expect(appearanceConfig("female").showsStage).toBe(true);
    expect(appearanceConfig("male").showsStage).toBe(true);
    expect(appearanceConfig("voice-only").showsStage).toBe(false);
    expect(appearanceConfig("male").pitch).toBeLessThan(appearanceConfig("female").pitch);
  });

  it("keeps the interrupt budget at 300ms", () => {
    expect(INTERRUPT_BUDGET_MS).toBe(300);
  });
});
