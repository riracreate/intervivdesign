/**
 * Pure theme resolution helpers, animated counter math, gauge geometry,
 * spaced-repetition priority classification, and structured AI workspace catalog.
 */

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "interviv-theme";

/**
 * Dark mode is the default across InterViv unless the user explicitly switches to light.
 */
export function resolveTheme(stored: string | null | undefined): ResolvedTheme {
  if (stored === "light") {
    return "light";
  }
  return "dark";
}

/**
 * Computes the next explicit theme when a user activates the dark/light toggle.
 */
export function toggleResolvedTheme(current: ResolvedTheme): ResolvedTheme {
  return current === "dark" ? "light" : "dark";
}

/**
 * Smooth ease-out cubic interpolation for count-up stat cards.
 */
export function interpolateCount(target: number, progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  const eased = 1 - Math.pow(1 - clamped, 3);
  return Math.round(target * eased);
}

/**
 * Circular SVG readiness gauge geometry (used on the Feedback / Results page).
 */
export function computeGaugeMetrics(
  score: number | null | undefined,
  radius = 64,
): {
  clampedScore: number;
  circumference: number;
  dashOffset: number;
} {
  const clampedScore =
    typeof score === "number" && Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clampedScore / 100) * circumference;
  return { clampedScore, circumference, dashOffset };
}

export type DuePriorityLevel = "overdue" | "due-today" | "upcoming";

/**
 * Classifies spaced-repetition items into priority tiers for home/dashboard chips.
 */
export function dueTopicPriority(
  nextDueIso: string,
  nowMs = Date.now(),
): { level: DuePriorityLevel; label: string } {
  const dueMs = Date.parse(nextDueIso);
  if (Number.isNaN(dueMs)) return { level: "due-today", label: "Due today" };
  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(nowMs);
  endOfToday.setHours(23, 59, 59, 999);

  if (dueMs < startOfToday.getTime()) return { level: "overdue", label: "Overdue" };
  if (dueMs <= endOfToday.getTime()) return { level: "due-today", label: "Due today" };
  const days = Math.max(1, Math.ceil((dueMs - endOfToday.getTime()) / 86_400_000));
  return { level: "upcoming", label: `In ${days}d` };
}

/**
 * Slices text cleanly for animated transcript typing effects.
 */
export function sliceTypedText(text: string, visibleChars: number): string {
  if (!text) return "";
  const clamped = Math.max(0, Math.min(text.length, Math.floor(visibleChars)));
  return text.slice(0, clamped);
}

/**
 * Estimates spoken vocal energy (0–100) from active phase, transcript length, and cadence.
 */
export function buildEnergyMeter(params: {
  transcript: string;
  listening: boolean;
  speaking: boolean;
}): number {
  if (params.speaking) return 76;
  const words = params.transcript.trim().split(/\s+/).filter(Boolean).length;
  if (!params.listening && words === 0) return 38;
  const base = params.listening ? 62 : 48;
  return Math.max(20, Math.min(98, base + Math.min(34, words * 2)));
}

export interface LandingModeCard {
  id: "voice" | "camera" | "avatar" | "coding" | "resume";
  title: string;
  to: "/voice" | "/engagement" | "/avatar" | "/problems" | "/resume";
  description: string;
  badge: string;
}

export const LANDING_MODES: LandingModeCard[] = [
  {
    id: "voice",
    title: "Voice",
    to: "/voice",
    description: "Speak answers out loud with live transcript, waveform cues, and follow-ups.",
    badge: "Live speech",
  },
  {
    id: "camera",
    title: "Camera",
    to: "/engagement",
    description: "On-device eye contact, gaze stability, and posture baseline calibration.",
    badge: "100% local",
  },
  {
    id: "avatar",
    title: "Avatar",
    to: "/avatar",
    description: "Interview with Viv — lip-synced 3D host with natural pauses and barge-in.",
    badge: "Viv 3D",
  },
  {
    id: "coding",
    title: "Coding",
    to: "/problems",
    description: "Interactive JavaScript unit tests and multi-table SQL grading in browser.",
    badge: "JS + SQL",
  },
  {
    id: "resume",
    title: "Resume",
    to: "/resume",
    description: "Extract skills from PDF or text, audit bullet metrics, and match target JDs.",
    badge: "PDF & JD",
  },
];

export interface HowItWorksStep {
  step: number;
  title: string;
  detail: string;
  to: "/resume" | "/practice" | "/learn";
  cta: string;
}

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    step: 1,
    title: "Calibrate your target",
    detail:
      "Extract skills from your resume and pick your target engineering role so gaps stay concrete.",
    to: "/resume",
    cta: "Extract resume",
  },
  {
    step: 2,
    title: "Practice in real conditions",
    detail:
      "Respond aloud to Voice or Viv, run live JavaScript & SQL tests, and check posture locally.",
    to: "/practice",
    cta: "Start round",
  },
  {
    step: 3,
    title: "Lock concepts in memory",
    detail:
      "Inspect your deterministic 4-dimension rubric breakdown and revisit due SM-2 review topics.",
    to: "/learn",
    cta: "Open review queue",
  },
];
