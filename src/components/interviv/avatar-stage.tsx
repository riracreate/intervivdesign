import { useEffect, useRef } from "react";
import {
  appearanceConfig,
  breathingScale,
  gazeRotation,
  gazeTargetAt,
  mouthOpenAt,
  talkingAvatarStatus,
  type AvatarAppearance,
  type AvatarPose,
} from "@/lib/interviv/avatar";

/**
 * Viv 3D stage. `three` and `@interviewflowai/talking-avatar` are loaded
 * with dynamic import() inside this component, which is itself only imported
 * by the /avatar route — neither library touches any other route's bundle.
 *
 * Engine order: TalkingAvatar (Rocketbox GLB + viseme model) when its CDN
 * assets load; otherwise a procedural three.js head driven by the same
 * behavior functions (mouth follows speech, gaze breaks, breathing).
 * Voice-only never imports three at all.
 */
export function AvatarStage({
  appearance,
  pose,
}: {
  appearance: AvatarAppearance;
  pose: AvatarPose;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const poseRef = useRef(pose);
  poseRef.current = pose;
  // TalkingAvatar handle (setStatus only — typed loosely, lib is dynamic)
  const taRef = useRef<{
    setStatus: (s: "listening" | "thinking") => void;
    dispose: () => void;
  } | null>(null);

  useEffect(() => {
    taRef.current?.setStatus(talkingAvatarStatus(pose));
  }, [pose]);

  useEffect(() => {
    if (appearance === "voice-only") return;
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      // ── Preferred: TalkingAvatar GLB with real viseme lip-sync ───────────
      try {
        const ta = await import("@interviewflowai/talking-avatar");
        if (disposed) return;
        const avatar = new ta.TalkingAvatar({
          container: mount,
          avatarUrl: appearance === "male" ? ta.AVATARS.male : ta.AVATARS.female,
          onError: (e) => console.info("[avatar] TalkingAvatar:", e.message),
        });
        taRef.current = avatar as unknown as typeof taRef.current;
        avatar.setStatus(talkingAvatarStatus(poseRef.current));
        await avatar.ready;
        cleanup = () => {
          try {
            avatar.dispose();
          } catch {
            /* already gone */
          }
          taRef.current = null;
        };
        return;
      } catch (e) {
        console.info("[avatar] TalkingAvatar unavailable, using procedural head:", e);
      }
      if (disposed) return;
      // ── Fallback: procedural three.js head (offline-safe) ─────────────────
      cleanup = await mountProceduralHead(
        mount,
        appearance,
        () => poseRef.current,
        () => disposed,
      );
    })();

    return () => {
      disposed = true;
      cleanup?.();
      mount.replaceChildren();
    };
    // Re-mount when appearance changes (avatar swap)
  }, [appearance]);

  if (appearance === "voice-only") {
    return (
      <div className="avatar-voice-only" role="img" aria-label="Voice-only mode: no avatar shown">
        <span className="avatar-voice-pulse" aria-hidden />
        Viv is listening by voice only. No avatar is rendered in this mode.
      </div>
    );
  }

  const cfg = appearanceConfig(appearance);
  return (
    <div className="avatar-stage-wrap">
      <div
        ref={mountRef}
        className="avatar-stage"
        aria-label={`Viv avatar (${cfg.label})`}
        role="img"
      />
      <span className="pill avatar-pose-pill">
        {pose === "speaking"
          ? "Viv is speaking…"
          : pose === "thinking"
            ? "Viv is thinking…"
            : pose === "listening"
              ? "Viv is listening"
              : "Viv is ready"}
      </span>
      <style>{`
        .avatar-stage-wrap{position:relative}
        .avatar-stage{width:100%;aspect-ratio:4/3;border-radius:14px;overflow:hidden;background:var(--muted);border:1px solid var(--border)}
        .avatar-stage canvas{width:100%!important;height:100%!important;display:block}
        .avatar-pose-pill{position:absolute;left:10px;bottom:10px;background:var(--card)}
        .avatar-voice-only{display:flex;gap:10px;align-items:center;border:1px dashed var(--border);border-radius:14px;padding:18px;background:var(--sidebar)}
        .avatar-voice-pulse{width:12px;height:12px;border-radius:50%;background:var(--primary);flex:none}
      `}</style>
    </div>
  );
}

// ─── Procedural head ──────────────────────────────────────────────────────────
// Stylized but recognizable: skull, jaw-driven mouth, eyes with blinks,
// neck + shoulders, hair cap. Built from spheres/capsules with rounded forms
// (no stacked-box look). Colors use the app's sage/lavender/peach tokens.
async function mountProceduralHead(
  mount: HTMLElement,
  appearance: AvatarAppearance,
  getPose: () => AvatarPose,
  isDisposed: () => boolean,
): Promise<() => void> {
  const THREE = await import("three");
  if (isDisposed()) return () => {};

  const female = appearance !== "male";
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeef2e6);
  const camera = new THREE.PerspectiveCamera(34, 4 / 3, 0.1, 100);
  camera.position.set(0, 0.35, 4.6);
  camera.lookAt(0, 0.15, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(mount.clientWidth || 640, mount.clientHeight || 480);
  mount.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2.5, 3, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe8d8, 0.5);
  fill.position.set(-3, 1, 2);
  scene.add(fill);

  const skin = new THREE.MeshStandardMaterial({
    color: female ? 0xe8bfa5 : 0xdbb08f,
    roughness: 0.65,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: female ? 0x4a3428 : 0x2e2a26,
    roughness: 0.85,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: female ? 0x5b7a5e : 0x6b6390,
    roughness: 0.9,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2622, roughness: 0.4 });

  const root = new THREE.Group();
  scene.add(root);
  const torso = new THREE.Group();
  root.add(torso);

  // Shoulders / chest (rounded capsule-ish form)
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.95, 32, 24), shirtMat);
  chest.scale.set(1.25, 0.72, 0.62);
  chest.position.y = -1.28;
  torso.add(chest);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.26, 0.5, 24), skin);
  neck.position.y = -0.62;
  torso.add(neck);

  const head = new THREE.Group();
  head.position.y = 0.18;
  root.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.72, 40, 32), skin);
  skull.scale.set(0.88, 1.05, 0.94);
  head.add(skull);
  // Hair cap (slightly larger half-sphere, offset up/back; longer back panel for female)
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.75, 40, 32), hairMat);
  hair.scale.set(0.92, 1.06, 0.97);
  hair.position.set(0, 0.09, -0.05);
  head.add(hair);
  const faceMask = new THREE.Mesh(new THREE.SphereGeometry(0.7, 40, 32), skin);
  faceMask.scale.set(0.82, 0.98, 0.9);
  faceMask.position.set(0, -0.04, 0.1);
  head.add(faceMask);
  if (female) {
    const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 24), hairMat);
    backHair.scale.set(1.0, 1.35, 0.55);
    backHair.position.set(0, -0.42, -0.34);
    head.add(backHair);
  }
  // Eyes + brows
  const eyeGeo = new THREE.SphereGeometry(0.055, 16, 16);
  const eyeL = new THREE.Mesh(eyeGeo, dark);
  eyeL.position.set(-0.24, 0.1, 0.6);
  const eyeR = new THREE.Mesh(eyeGeo, dark);
  eyeR.position.set(0.24, 0.1, 0.6);
  head.add(eyeL, eyeR);
  // Nose (small rounded cone) + mouth (jaw-driven)
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), skin);
  nose.scale.set(0.8, 1.3, 0.8);
  nose.position.set(0, -0.08, 0.66);
  head.add(nose);
  const mouth = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 20, 16),
    new THREE.MeshStandardMaterial({ color: 0x9c5a54, roughness: 0.55 }),
  );
  mouth.position.set(0, -0.36, 0.58);
  mouth.scale.set(1.5, 0.35, 0.6);
  head.add(mouth);

  const clock = new THREE.Clock();
  let raf = 0;
  const onResize = () => {
    const w = mount.clientWidth || 640;
    const h = mount.clientHeight || 480;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener("resize", onResize);

  const animate = () => {
    raf = requestAnimationFrame(animate);
    const t = clock.getElapsedTime() * 1000;
    const pose = getPose();
    // Breathing (idle motion with intent: chest + slight head bob)
    const breath = breathingScale(t, pose);
    torso.scale.setScalar(breath);
    head.position.y = 0.18 + (breath - 1) * 1.6;
    // Gaze: thinking looks down; periodic natural side breaks; else camera
    const rot = gazeRotation(gazeTargetAt(t, pose));
    head.rotation.x += (rot.x - head.rotation.x) * 0.06;
    head.rotation.y += (rot.y - head.rotation.y) * 0.06;
    // Lip-sync: mouth follows speech envelope while speaking
    const open = mouthOpenAt(t, pose);
    mouth.scale.y = 0.35 + open * 1.5;
    mouth.scale.x = 1.5 - open * 0.35;
    // Blink every ~3.4s for 120ms
    const blink = t % 3400 < 120 ? 0.12 : 1;
    eyeL.scale.y = blink;
    eyeR.scale.y = blink;
    renderer.render(scene, camera);
  };
  animate();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      }
    });
    renderer.dispose();
    renderer.domElement.remove();
  };
}
