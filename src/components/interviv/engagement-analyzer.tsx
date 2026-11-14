import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/interviv/workspace";
import { supabase } from "@/integrations/supabase/client";
import {
  FACE_INTERVAL_MS,
  POSE_INTERVAL_MS,
  shouldRun,
  isEyeContact,
  eyeContactPct,
  baselineFromWindow,
  postureScore,
  aggregateQuestion,
  liveEngagementScore,
  engagementLabel,
  presenceStatus,
  type FaceSample,
  type PoseSample,
  type EngagementAggregate,
  type PostureBaseline,
} from "@/lib/interviv/engagement";
import { Heading, ArrowRight } from "./ui";
import { toast } from "sonner";

type Stage = "consent" | "live" | "done";

export function EngagementAnalyzer() {
  const { user } = useWorkspace();
  const [stage, setStage] = useState<Stage>("consent");
  const [consented, setConsented] = useState(false);
  const [running, setRunning] = useState(false);
  const [modelStatus, setModelStatus] = useState<string>(
    "Not loaded — starts only after you consent and press Start camera.",
  );
  const [faces, setFaces] = useState<FaceSample[]>([]);
  const [poses, setPoses] = useState<PoseSample[]>([]);
  const [baseline, setBaseline] = useState<PostureBaseline | null>(null);
  const [questionId, setQuestionId] = useState("q1");
  const [aggregates, setAggregates] = useState<EngagementAggregate[]>([]);
  const [sessionId] = useState(() => crypto.randomUUID());

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastFaceRef = useRef(0);
  const lastPoseRef = useRef(0);
  const facesRef = useRef<FaceSample[]>([]);
  const posesRef = useRef<PoseSample[]>([]);
  // MediaPipe landmarker handles (untyped: loaded dynamically, browser-only)
  const faceLmRef = useRef<{ detectForVideo: (v: HTMLVideoElement, t: number) => unknown } | null>(
    null,
  );
  const poseLmRef = useRef<{ detectForVideo: (v: HTMLVideoElement, t: number) => unknown } | null>(
    null,
  );

  const stopAll = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRunning(false);
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  async function startCamera() {
    if (!consented) {
      toast.error("Please review and accept the local-processing consent first.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStage("live");
      setRunning(true);
      setModelStatus(
        "Loading MediaPipe models locally… (first load needs network for the WASM + model files; video itself never leaves this device)",
      );
      void loadModels();
      loop();
    } catch {
      toast.error("Camera permission was denied or no camera is available.");
    }
  }

  async function loadModels() {
    try {
      // Dynamic import keeps MediaPipe out of the main bundle and off the server.
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/wasm",
      );
      const face = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 2,
        outputFacialTransformationMatrixes: true,
      });
      faceLmRef.current = face as unknown as typeof faceLmRef.current;
      const pose = await vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      poseLmRef.current = pose as unknown as typeof poseLmRef.current;
      setModelStatus(
        "MediaPipe Face (10 fps) + Pose (5 fps) running locally. Frames are analyzed in-memory and discarded — nothing is uploaded or recorded.",
      );
    } catch (e) {
      console.info("[engagement] MediaPipe unavailable, demo estimation active:", e);
      setModelStatus(
        "MediaPipe models could not be loaded (offline or blocked CDN). Showing setup guidance only — connect once to cache the models, then analysis runs fully on-device.",
      );
    }
  }

  function loop() {
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      const now = performance.now();

      if (shouldRun(lastFaceRef.current, now, FACE_INTERVAL_MS)) {
        lastFaceRef.current = now;
        const sample = detectFace(video, now);
        if (sample) {
          facesRef.current = [...facesRef.current.slice(-600), sample];
          setFaces(facesRef.current);
        }
      }
      if (shouldRun(lastPoseRef.current, now, POSE_INTERVAL_MS)) {
        lastPoseRef.current = now;
        const sample = detectPose(video, now);
        if (sample) {
          posesRef.current = [...posesRef.current.slice(-300), sample];
          setPoses(posesRef.current);
          if (!baseline) {
            const b = baselineFromWindow(posesRef.current);
            // Baseline locks after ~10s of pose samples (first sample + 10s window)
            if (b && posesRef.current.length >= 20) setBaseline(b);
          }
        }
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  // Returns null when MediaPipe has no result yet; the UI then shows “warming up”.
  function detectFace(video: HTMLVideoElement, now: number): FaceSample | null {
    const lm = faceLmRef.current;
    if (!lm) return null;
    try {
      const res = lm.detectForVideo(video, now) as {
        faceLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
        facialTransformationMatrixes?: Array<{ data?: number[] }>;
      };
      const count = res.faceLandmarks?.length ?? 0;
      if (count === 0)
        return { timestampMs: now, yaw: 0, pitch: 0, gazeX: 0, gazeY: 0, faceCount: 0 };
      // Head pose from transformation matrix (rotation approx) when available.
      let yaw = 0;
      let pitch = 0;
      const m = res.facialTransformationMatrixes?.[0]?.data;
      if (m && m.length >= 11) {
        yaw = Math.round(((Math.atan2(-(m[2] ?? 0), m[10] ?? 1) * 180) / Math.PI) * 10) / 10;
        pitch = Math.round(((Math.atan2(m[6] ?? 0, m[10] ?? 1) * 180) / Math.PI) * 10) / 10;
      }
      // Gaze proxy: nose tip offset from face center (landmarks 1 = nose, 10/152 = bounds)
      const pts = res.faceLandmarks?.[0] ?? [];
      const nose = pts[1];
      const left = pts[234];
      const right = pts[454];
      let gazeX = 0;
      if (nose && left && right) {
        const center = (left.x + right.x) / 2;
        const half = Math.max(0.01, Math.abs(right.x - left.x) / 2);
        gazeX = Math.max(-1, Math.min(1, (nose.x - center) / half));
      }
      return { timestampMs: now, yaw, pitch, gazeX, gazeY: 0, faceCount: count };
    } catch {
      return null;
    }
  }

  function detectPose(video: HTMLVideoElement, now: number): PoseSample | null {
    const lm = poseLmRef.current;
    if (!lm) return null;
    try {
      const res = lm.detectForVideo(video, now) as {
        landmarks?: Array<Array<{ x: number; y: number; z: number }>>;
      };
      const pts = res.landmarks?.[0];
      if (!pts || pts.length < 25) return null;
      const ls = pts[11]!;
      const rs = pts[12]!;
      const nose = pts[0]!;
      const shoulderY = (ls.y + rs.y) / 2;
      const shoulderWidth = Math.abs(rs.x - ls.x);
      const midX = (ls.x + rs.x) / 2;
      const neckAngle = Math.round(
        (Math.atan2(nose.x - midX, Math.max(0.01, nose.y - shoulderY)) * 180) / Math.PI,
      );
      return { timestampMs: now, shoulderY, neckAngle, shoulderWidth };
    } catch {
      return null;
    }
  }

  async function markQuestion() {
    const agg = aggregateQuestion(questionId, facesRef.current, posesRef.current, baseline);
    setAggregates((prev) => [...prev.filter((a) => a.questionId !== questionId), agg]);
    if (user) {
      await supabase
        .from("engagement_stats" as never)
        .insert({
          session_id: sessionId,
          user_id: user.id,
          question_id: agg.questionId,
          eye_contact_pct: agg.eyeContactPct,
          gaze_away_count: agg.gazeAwayCount,
          longest_gaze_away_ms: agg.longestGazeAwayMs,
          posture_score: agg.postureScore,
          left_frame: agg.leftFrame,
          extra_person: agg.extraPerson,
          samples: agg.samples,
        } as never)
        .then(({ error }) => {
          if (error) console.info("[engagement] engagement_stats not yet migrated:", error.message);
          else toast.success(`Saved engagement for ${questionId}.`);
        });
    } else {
      toast.success(`Recorded ${questionId} locally. Sign in to persist aggregates.`);
    }
    facesRef.current = [];
    posesRef.current = [];
    setFaces([]);
    setPoses([]);
  }

  const latest = faces[faces.length - 1] ?? null;
  const liveScore = liveEngagementScore(faces, poses, baseline);
  const status = presenceStatus(latest);
  const currentPosture =
    poses.length && baseline ? postureScore(poses[poses.length - 1]!, baseline) : null;

  if (stage === "consent") {
    return (
      <>
        <Heading
          eyebrow="Camera engagement analyzer"
          title="Practice presence, privately."
          subtitle="Optional camera feedback for eye contact and posture. Analysis happens entirely on this device."
        />
        <section className="panel stack" aria-labelledby="consent-title">
          <h2 id="consent-title">Before your camera turns on</h2>
          <ul className="consent-list">
            <li>
              <b>Local-only processing.</b> MediaPipe Face and Pose Landmarkers run in your browser
              (WebAssembly). Video frames are analyzed in memory and immediately discarded.
            </li>
            <li>
              <b>No video ever leaves the browser.</b> We never record, upload, or stream your
              camera. Only small numeric aggregates (for example eye-contact %) can be saved to your
              private account — and only when you press “Save question stats”.
            </li>
            <li>
              <b>What is measured.</b> Eye-contact %, head pose, gaze-away events, posture vs. your
              first-10-second baseline, leaving the frame, and an additional person entering the
              frame.
            </li>
            <li>
              <b>Your control.</b> You can stop the camera at any time. Denying permission simply
              disables this tool; the rest of InterViv works without a camera. This is practice
              feedback, not proctoring or identity verification.
            </li>
          </ul>
          <label className="consent-check">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
            />
            I understand video stays on this device and only numeric aggregates may be saved.
          </label>
          <div className="row">
            <Button onClick={startCamera} disabled={!consented}>
              Enable camera & start
            </Button>
            <Button variant="outline" asChild>
              <Link to="/voice">Use voice-only practice instead</Link>
            </Button>
          </div>
          <p className="tiny text-muted">
            Throttling: face at 10 fps, pose at 5 fps to limit CPU. Keep one person centered, face
            well-lit, camera at eye level.
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <Heading
        eyebrow="Camera engagement · local-only"
        title="Your live presence meter."
        subtitle={modelStatus}
        action={
          <div className="row">
            <span className={`pill ${status === "in-frame" ? "" : "warning"}`}>
              {status === "in-frame"
                ? "In frame"
                : status === "left-frame"
                  ? "Left frame"
                  : status === "extra-person"
                    ? "Extra person detected"
                    : status === "looking-away"
                      ? "Looking away"
                      : "Warming up"}
            </span>
            <Button
              variant="outline"
              onClick={() => {
                stopAll();
                setStage("done");
              }}
            >
              Stop camera
            </Button>
          </div>
        }
      />

      <div className="engagement-grid">
        <section className="panel stack">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="camera-preview"
            aria-label="Camera preview (local only, not recorded)"
          />
          <p className="tiny text-muted">
            Preview is mirrored for your convenience. Frames are not recorded or transmitted.{" "}
            {running ? "Camera live." : "Camera stopped."}
          </p>
          <div className="row">
            <label>
              Question label{" "}
              <input
                value={questionId}
                onChange={(e) => setQuestionId(e.target.value)}
                aria-label="Current question label"
              />
            </label>
            <Button onClick={markQuestion} disabled={!faces.length && !poses.length}>
              Save question stats
            </Button>
          </div>
          {!baseline && poses.length > 0 && (
            <p className="notice">
              Calibrating posture baseline from your first 10 seconds… hold a comfortable upright
              pose ({poses.length} samples).
            </p>
          )}
          {baseline && (
            <p className="tiny text-muted">
              Posture baseline locked. Current slouch score: {currentPosture ?? "—"}/100 (100 = your
              baseline).
            </p>
          )}
        </section>

        <aside className="panel stack" aria-live="polite">
          <h3>Live engagement</h3>
          <div
            className="meter"
            role="meter"
            aria-valuenow={liveScore}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Live engagement score"
          >
            <div className="meter-fill" style={{ width: `${liveScore}%` }} />
          </div>
          <p>
            <b>
              {liveScore}/100 · {engagementLabel(liveScore)}
            </b>
          </p>
          <dl className="stat-list">
            <div>
              <dt>Eye contact (session)</dt>
              <dd>
                {eyeContactPct(faces)}% · {faces.length} face samples @10fps
              </dd>
            </div>
            <div>
              <dt>Head pose (latest)</dt>
              <dd>{latest ? `yaw ${latest.yaw}° · pitch ${latest.pitch}°` : "—"}</dd>
            </div>
            <div>
              <dt>Gaze</dt>
              <dd>{latest ? (isEyeContact(latest) ? "On camera" : "Away from camera") : "—"}</dd>
            </div>
            <div>
              <dt>Posture</dt>
              <dd>
                {currentPosture != null
                  ? `${currentPosture}/100 vs baseline`
                  : baseline
                    ? "Measuring…"
                    : "Calibrating (first 10s)…"}
              </dd>
            </div>
            <div>
              <dt>Presence</dt>
              <dd>{status}</dd>
            </div>
          </dl>
          <p className="tiny text-muted">
            Guidance only — lighting, glasses, and camera angle affect these estimates. Not a hiring
            or proctoring judgment.
          </p>
        </aside>
      </div>

      {aggregates.length > 0 && (
        <section className="panel stack">
          <h3>Per-question aggregates</h3>
          <table className="activity-table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Eye contact</th>
                <th>Gaze aways</th>
                <th>Longest away</th>
                <th>Posture</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {aggregates.map((a) => (
                <tr key={a.questionId}>
                  <td>{a.questionId}</td>
                  <td>{a.eyeContactPct}%</td>
                  <td>{a.gazeAwayCount}</td>
                  <td>{(a.longestGazeAwayMs / 1000).toFixed(1)}s</td>
                  <td>{a.postureScore}/100</td>
                  <td>
                    {[a.leftFrame ? "left frame" : "", a.extraPerson ? "extra person" : ""]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tiny text-muted">
            Aggregates save to <code>engagement_stats</code> (Drizzle table in db-tables.ts; apply
            DDL via Lovable). Raw video is never stored.
          </p>
        </section>
      )}

      {stage === "done" && (
        <div className="notice">
          Camera stopped and stream released.{" "}
          <Button variant="outline" size="sm" onClick={() => setStage("consent")}>
            Review consent & restart
          </Button>
        </div>
      )}

      <style>{`
        .engagement-grid{display:grid;grid-template-columns:1.3fr 1fr;gap:16px;align-items:start}
        @media(max-width:900px){.engagement-grid{grid-template-columns:1fr}}
        .camera-preview{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;background:#111;transform:scaleX(-1)}
        .consent-list{display:grid;gap:8px;padding-left:18px}
        .consent-check{display:flex;gap:8px;align-items:flex-start}
        .meter{height:14px;border-radius:999px;background:var(--muted);overflow:hidden;border:1px solid var(--border)}
        .meter-fill{height:100%;background:var(--primary);transition:width .3s ease}
        .stat-list{display:grid;gap:8px}
        .stat-list div{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--border);padding-top:6px}
        .stat-list dt{color:var(--muted-foreground)} .stat-list dd{margin:0;font-weight:600;text-align:right}
      `}</style>
      <div className="row mt-5">
        <Button variant="outline" asChild>
          <Link to="/voice">
            Back to voice interview <ArrowRight />
          </Link>
        </Button>
      </div>
    </>
  );
}
