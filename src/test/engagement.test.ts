import { describe, it, expect } from "vitest";
import {
  shouldRun,
  isEyeContact,
  eyeContactPct,
  gazeAwayEvents,
  sustainedGazeEvents,
  calibrateBaseline,
  baselineFromWindow,
  postureScore,
  aggregateQuestion,
  liveEngagementScore,
  presenceStatus,
  FACE_INTERVAL_MS,
  POSE_INTERVAL_MS,
  type FaceSample,
  type PoseSample,
} from "@/lib/interviv/engagement";

const face = (t: number, over: Partial<FaceSample> = {}): FaceSample => ({
  timestampMs: t,
  yaw: 0,
  pitch: 0,
  gazeX: 0,
  gazeY: 0,
  faceCount: 1,
  ...over,
});
const pose = (t: number, over: Partial<PoseSample> = {}): PoseSample => ({
  timestampMs: t,
  shoulderY: 0.5,
  neckAngle: 5,
  shoulderWidth: 0.3,
  ...over,
});

describe("engagement — throttling", () => {
  it("gates face at 10fps and pose at 5fps", () => {
    expect(FACE_INTERVAL_MS).toBe(100);
    expect(POSE_INTERVAL_MS).toBe(200);
    expect(shouldRun(1000, 1099, FACE_INTERVAL_MS)).toBe(false);
    expect(shouldRun(1000, 1100, FACE_INTERVAL_MS)).toBe(true);
    expect(shouldRun(1000, 1150, POSE_INTERVAL_MS)).toBe(false);
    expect(shouldRun(1000, 1200, POSE_INTERVAL_MS)).toBe(true);
  });
});

describe("engagement — eye contact & gaze-away", () => {
  it("classifies eye contact by yaw/pitch/gaze thresholds", () => {
    expect(isEyeContact(face(0))).toBe(true);
    expect(isEyeContact(face(0, { yaw: 25 }))).toBe(false);
    expect(isEyeContact(face(0, { gazeX: 0.6 }))).toBe(false);
    expect(eyeContactPct([face(0), face(100, { yaw: 40 }), face(200)])).toBe(67);
  });

  it("segments gaze-away runs and flags sustained off-screen gaze", () => {
    const samples = [
      face(0),
      face(500, { yaw: 40 }),
      face(1500, { yaw: 40 }),
      face(2600, { yaw: 40 }), // 2.1s away run
      face(3000),
      face(3500, { yaw: 40 }),
      face(4000), // short 0.5s glance
    ];
    const all = gazeAwayEvents(samples);
    expect(all).toHaveLength(2);
    expect(all[0]!.durationMs).toBe(2500);
    expect(sustainedGazeEvents(samples)).toHaveLength(1);
    expect(sustainedGazeEvents(samples)[0]!.durationMs).toBeGreaterThanOrEqual(2000);
  });

  it("detects leaving frame and extra person via presence", () => {
    expect(presenceStatus(face(0, { faceCount: 0 }))).toBe("left-frame");
    expect(presenceStatus(face(0, { faceCount: 2 }))).toBe("extra-person");
    expect(presenceStatus(face(0, { yaw: 50 }))).toBe("looking-away");
    expect(presenceStatus(null)).toBe("unknown");
  });
});

describe("engagement — posture vs 10s baseline", () => {
  it("calibrates baseline from the first 10 seconds only", () => {
    const samples = [pose(0), pose(5000), pose(9999), pose(15000, { shoulderY: 0.9 })];
    const b = baselineFromWindow(samples)!;
    expect(b.shoulderY).toBeCloseTo(0.5);
    expect(calibrateBaseline([])).toBeNull();
  });

  it("scores slouch lower when shoulders drop and neck bends", () => {
    const baseline = { shoulderY: 0.5, neckAngle: 5, shoulderWidth: 0.3 };
    expect(postureScore(pose(0), baseline)).toBe(100);
    const slouched = postureScore(
      pose(0, { shoulderY: 0.65, neckAngle: 25, shoulderWidth: 0.22 }),
      baseline,
    );
    expect(slouched).toBeLessThan(60);
    expect(slouched).toBeGreaterThanOrEqual(0);
  });

  it("aggregates per-question stats without raw video", () => {
    const baseline = { shoulderY: 0.5, neckAngle: 5, shoulderWidth: 0.3 };
    const agg = aggregateQuestion(
      "q1",
      [face(0), face(500, { faceCount: 0 }), face(1000, { faceCount: 2 })],
      [pose(0), pose(500)],
      baseline,
    );
    expect(agg.leftFrame).toBe(true);
    expect(agg.extraPerson).toBe(true);
    expect(agg.samples).toBe(3);
    expect(liveEngagementScore([face(0)], [pose(0)], baseline)).toBeGreaterThan(50);
  });
});
