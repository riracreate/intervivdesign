// ─── Viv avatar behavior — pure state/timing logic (rendering lives in the stage) ──

export type AvatarAppearance = "female" | "male" | "voice-only";
export type AvatarPose = "idle" | "speaking" | "thinking" | "listening";

export const INTERRUPT_BUDGET_MS = 300;
export const THINKING_MIN_MS = 1000;
export const THINKING_MAX_MS = 2000;

export type AppearanceConfig = {
  id: AvatarAppearance;
  label: string;
  /** speechSynthesis voice shaping */
  pitch: number;
  rate: number;
  /** stage accent (existing palette tokens only) */
  accent: string;
  showsStage: boolean;
};

export const APPEARANCES: AppearanceConfig[] = [
  {
    id: "female",
    label: "Viv · Female avatar",
    pitch: 1.1,
    rate: 1,
    accent: "sage",
    showsStage: true,
  },
  {
    id: "male",
    label: "Viv · Male avatar",
    pitch: 0.85,
    rate: 0.98,
    accent: "lavender",
    showsStage: true,
  },
  {
    id: "voice-only",
    label: "Voice only (no avatar)",
    pitch: 1,
    rate: 1,
    accent: "peach",
    showsStage: false,
  },
];

export function appearanceConfig(id: AvatarAppearance): AppearanceConfig {
  return APPEARANCES.find((a) => a.id === id) ?? APPEARANCES[0]!;
}

/** 1–2s look-down thinking pause before a follow-up. `rand` in [0,1). */
export function thinkingPauseMs(rand = Math.random()): number {
  const r = Math.max(0, Math.min(0.9999, rand));
  return Math.round(THINKING_MIN_MS + r * (THINKING_MAX_MS - THINKING_MIN_MS));
}

export type GazeTarget = "camera" | "down" | "side";

/**
 * Natural gaze: mostly camera; brief side breaks every ~7s (600ms);
 * "down" while thinking. Deterministic in (elapsedMs, pose) for tests.
 */
export function gazeTargetAt(elapsedMs: number, pose: AvatarPose): GazeTarget {
  if (pose === "thinking") return "down";
  const cycle = elapsedMs % 7000;
  if (cycle > 6400) return "side"; // 600ms break per 7s cycle
  return "camera";
}

/** Head rotation (radians) for a gaze target. */
export function gazeRotation(target: GazeTarget): { x: number; y: number } {
  switch (target) {
    case "down":
      return { x: 0.32, y: 0 };
    case "side":
      return { x: 0.04, y: 0.45 };
    default:
      return { x: 0, y: 0 };
  }
}

/** Idle breathing: subtle chest/head scale, 4s cycle. Returns scale factor ~0.99..1.01. */
export function breathingScale(elapsedMs: number, pose: AvatarPose): number {
  const amp = pose === "speaking" ? 0.006 : 0.012;
  return 1 + amp * Math.sin((elapsedMs / 4000) * Math.PI * 2);
}

/**
 * Mouth openness 0..1. While speaking, oscillates like syllables (~6Hz with
 * variation); otherwise nearly closed. Drives jaw/mouth scale in the stage
 * and mirrors TalkingAvatar viseme activity conceptually.
 */
export function mouthOpenAt(elapsedMs: number, pose: AvatarPose): number {
  if (pose !== "speaking") return pose === "listening" ? 0.04 : 0.02;
  const syllable = 0.5 + 0.5 * Math.sin(elapsedMs / 55);
  const phrase = 0.7 + 0.3 * Math.sin(elapsedMs / 340);
  return Math.max(0.08, Math.min(1, syllable * phrase));
}

/** Pose that pairs each interview phase (for UI + stage). */
export function poseForPhase(
  phase: "asking" | "thinking" | "listening" | "review" | "idle",
): AvatarPose {
  switch (phase) {
    case "asking":
      return "speaking";
    case "thinking":
      return "thinking";
    case "listening":
      return "listening";
    default:
      return "idle";
  }
}

/** TalkingAvatar status bridge: it only knows listening/thinking while silent. */
export function talkingAvatarStatus(pose: AvatarPose): "listening" | "thinking" {
  return pose === "thinking" ? "thinking" : "listening";
}
