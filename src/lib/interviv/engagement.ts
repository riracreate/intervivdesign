// ─── Camera engagement — pure analysis (no video ever leaves the browser) ────
// Landmark math is isolated here so it is unit-testable without a camera.
// The component feeds MediaPipe results in; tests feed synthetic landmarks.

export type FaceSample = {
  timestampMs: number;
  /** head yaw in degrees: 0 = facing camera, + = turned right */
  yaw: number;
  /** head pitch in degrees: 0 = level, + = looking down */
  pitch: number;
  /** normalized gaze offset -1..1 (0 = centered) */
  gazeX: number;
  gazeY: number;
  faceCount: number;
};

export type PoseSample = {
  timestampMs: number;
  /** shoulder midpoint Y (normalized 0..1, smaller = higher in frame) */
  shoulderY: number;
  /** neck angle in degrees from vertical (0 = upright) */
  neckAngle: number;
  /** shoulder width normalized — drops when slouching/leaning back */
  shoulderWidth: number;
};

export type EngagementAggregate = {
  questionId: string;
  eyeContactPct: number;
  gazeAwayCount: number;
  longestGazeAwayMs: number;
  postureScore: number; // 0..100, 100 = matches baseline
  leftFrame: boolean;
  extraPerson: boolean;
  samples: number;
};

export const FACE_FPS = 10;
export const POSE_FPS = 5;
export const FACE_INTERVAL_MS = 1000 / FACE_FPS; // 100ms
export const POSE_INTERVAL_MS = 1000 / POSE_FPS; // 200ms
export const BASELINE_MS = 10_000;
export const SUSTAINED_GAZE_MS = 2_000;

/** Throttle gate: true when enough time passed for the target fps. */
export function shouldRun(lastMs: number, nowMs: number, intervalMs: number): boolean {
  return nowMs - lastMs >= intervalMs;
}

/** Eye contact when head is roughly frontal and gaze is centered. */
export function isEyeContact(s: FaceSample): boolean {
  return (
    Math.abs(s.yaw) <= 18 &&
    Math.abs(s.pitch) <= 20 &&
    Math.abs(s.gazeX) <= 0.35 &&
    Math.abs(s.gazeY) <= 0.35
  );
}

export function eyeContactPct(samples: FaceSample[]): number {
  if (!samples.length) return 0;
  const hit = samples.filter(isEyeContact).length;
  return Math.round((hit / samples.length) * 100);
}

export type GazeAwayEvent = { startMs: number; endMs: number; durationMs: number };

/** Contiguous non-eye-contact runs; sustained = >= SUSTAINED_GAZE_MS. */
export function gazeAwayEvents(
  samples: FaceSample[],
  sustainedMs = SUSTAINED_GAZE_MS,
): GazeAwayEvent[] {
  const events: GazeAwayEvent[] = [];
  let start: number | null = null;
  let last = 0;
  for (const s of samples) {
    last = s.timestampMs;
    if (!isEyeContact(s)) {
      if (start === null) start = s.timestampMs;
    } else if (start !== null) {
      events.push({ startMs: start, endMs: s.timestampMs, durationMs: s.timestampMs - start });
      start = null;
    }
  }
  if (start !== null)
    events.push({ startMs: start, endMs: last, durationMs: Math.max(0, last - start) });
  return events;
}

export function sustainedGazeEvents(
  samples: FaceSample[],
  sustainedMs = SUSTAINED_GAZE_MS,
): GazeAwayEvent[] {
  return gazeAwayEvents(samples, sustainedMs).filter((e) => e.durationMs >= sustainedMs);
}

// ─── Pose / posture ───────────────────────────────────────────────────────────

export type PostureBaseline = { shoulderY: number; neckAngle: number; shoulderWidth: number };

export function calibrateBaseline(samples: PoseSample[]): PostureBaseline | null {
  if (!samples.length) return null;
  const avg = (f: (s: PoseSample) => number) =>
    samples.reduce((a, s) => a + f(s), 0) / samples.length;
  return {
    shoulderY: avg((s) => s.shoulderY),
    neckAngle: avg((s) => s.neckAngle),
    shoulderWidth: avg((s) => s.shoulderWidth),
  };
}

/** Baseline = first 10s window. Returns null when window is empty. */
export function baselineFromWindow(
  samples: PoseSample[],
  windowMs = BASELINE_MS,
): PostureBaseline | null {
  if (!samples.length) return null;
  const t0 = samples[0]!.timestampMs;
  return calibrateBaseline(samples.filter((s) => s.timestampMs - t0 <= windowMs));
}

/**
 * Slouch score 0..100 (100 = identical to baseline).
 * Penalizes: shoulders dropping (higher Y), neck bending, shoulders narrowing.
 */
export function postureScore(current: PoseSample, baseline: PostureBaseline): number {
  const drop = Math.max(0, current.shoulderY - baseline.shoulderY); // 0..~0.3
  const bend = Math.max(0, Math.abs(current.neckAngle - baseline.neckAngle)); // degrees
  const narrow = Math.max(0, baseline.shoulderWidth - current.shoulderWidth);
  const penalty = drop * 180 + bend * 1.6 + narrow * 120;
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

export function averagePosture(samples: PoseSample[], baseline: PostureBaseline | null): number {
  if (!samples.length || !baseline) return 0;
  return Math.round(samples.reduce((a, s) => a + postureScore(s, baseline), 0) / samples.length);
}

// ─── Frame presence ───────────────────────────────────────────────────────────

export function leftFrame(samples: FaceSample[]): boolean {
  return samples.some((s) => s.faceCount === 0);
}

export function extraPerson(samples: FaceSample[]): boolean {
  return samples.some((s) => s.faceCount > 1);
}

/** Current presence status for the live meter. */
export function presenceStatus(
  latest: FaceSample | null,
): "in-frame" | "left-frame" | "extra-person" | "looking-away" | "unknown" {
  if (!latest) return "unknown";
  if (latest.faceCount === 0) return "left-frame";
  if (latest.faceCount > 1) return "extra-person";
  if (!isEyeContact(latest)) return "looking-away";
  return "in-frame";
}

export function aggregateQuestion(
  questionId: string,
  faces: FaceSample[],
  poses: PoseSample[],
  baseline: PostureBaseline | null,
): EngagementAggregate {
  const events = gazeAwayEvents(faces);
  const longest = events.reduce((m, e) => Math.max(m, e.durationMs), 0);
  return {
    questionId,
    eyeContactPct: eyeContactPct(faces),
    gazeAwayCount: events.length,
    longestGazeAwayMs: longest,
    postureScore: averagePosture(poses, baseline),
    leftFrame: leftFrame(faces),
    extraPerson: extraPerson(faces),
    samples: faces.length,
  };
}

/** 0..100 blended engagement for the live meter (eye contact weighted most). */
export function liveEngagementScore(
  faces: FaceSample[],
  poses: PoseSample[],
  baseline: PostureBaseline | null,
): number {
  if (!faces.length) return 0;
  const eye = eyeContactPct(faces.slice(-30)); // last ~3s at 10fps
  const post = poses.length && baseline ? postureScore(poses[poses.length - 1]!, baseline) : 70;
  const presence = faces[faces.length - 1]!.faceCount === 1 ? 100 : 0;
  return Math.round(eye * 0.6 + post * 0.25 + presence * 0.15);
}

export function engagementLabel(score: number): string {
  if (score >= 75) return "Engaged";
  if (score >= 50) return "Mostly engaged";
  if (score >= 25) return "Drifting";
  return "Check your setup";
}
