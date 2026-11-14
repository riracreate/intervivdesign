import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/interviv/workspace";
import { makeQuestions, evaluate, type Question } from "@/lib/interviv/data";
import {
  getSpeechRecognitionCtor,
  isSpeechRecognitionSupported,
  speakText,
  stopSpeaking,
  interruptSpeech,
  makeVoiceEntry,
  voiceSessionScore,
  type VoiceEntry,
  type SpeechRecognitionLike,
} from "@/lib/interviv/voice";
import { generateFollowUp } from "@/lib/interviv/voice.functions";
import {
  appearanceConfig,
  APPEARANCES,
  thinkingPauseMs,
  poseForPhase,
  INTERRUPT_BUDGET_MS,
  type AvatarAppearance,
  type AvatarPose,
} from "@/lib/interviv/avatar";
import { AvatarStage } from "./avatar-stage";
import { FeedbackResultsView } from "./report";
import { Heading, Check, Mic, Video } from "./ui";
import { toast } from "sonner";

type Flow = "asking" | "thinking" | "listening" | "review" | "idle";

export function AvatarInterview() {
  const { user, saveSession } = useWorkspace();
  const [appearance, setAppearance] = useState<AvatarAppearance>("female");
  const [questions, setQuestions] = useState<Question[]>(() =>
    makeQuestions("interview", ["DBMS", "DSA"], 3),
  );
  const [index, setIndex] = useState(0);
  const [entries, setEntries] = useState<VoiceEntry[]>([]);
  const [flow, setFlow] = useState<Flow>("idle");
  const [live, setLive] = useState("");
  const [interruptMs, setInterruptMs] = useState<number | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [pipCamOn, setPipCamOn] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  useEffect(() => {
    setSpeechSupported(isSpeechRecognitionSupported());
  }, []);

  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const pipStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const askedAtRef = useRef(new Date().toISOString());
  const flowRef = useRef(flow);
  flowRef.current = flow;

  const currentQ = questions[index];
  const pose: AvatarPose = poseForPhase(flow);
  const cfg = appearanceConfig(appearance);

  useEffect(
    () => () => {
      stopSpeaking();
      try {
        recognitionRef.current?.abort();
      } catch {
        /* noop */
      }
      pipStreamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function togglePipCam() {
    if (pipCamOn) {
      pipStreamRef.current?.getTracks().forEach((t) => t.stop());
      pipStreamRef.current = null;
      if (pipVideoRef.current) pipVideoRef.current.srcObject = null;
      setPipCamOn(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 },
        audio: false,
      });
      pipStreamRef.current = stream;
      setPipCamOn(true);
      requestAnimationFrame(() => {
        if (pipVideoRef.current) {
          pipVideoRef.current.srcObject = stream;
          void pipVideoRef.current.play();
        }
      });
    } catch {
      toast.info("Camera preview unavailable — continuing without PiP feed.");
    }
  }

  function ask(q: Question) {
    askedAtRef.current = new Date().toISOString();
    setLive("");
    setFlow("asking");
    speakText(q.prompt, {
      pitch: cfg.pitch,
      rate: cfg.rate,
      onEnd: () => {
        if (flowRef.current === "asking") setFlow("idle");
      },
    });
    setTimeout(() => {
      if (flowRef.current === "asking") setFlow("idle");
    }, 6000);
  }

  function startListening() {
    if (!currentQ) return;
    const ms = interruptSpeech();
    setInterruptMs(ms);
    if (ms > INTERRUPT_BUDGET_MS)
      console.warn(`[avatar] interrupt took ${ms}ms (budget ${INTERRUPT_BUDGET_MS}ms)`);
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setFlow("listening");
      return;
    }
    try {
      recognitionRef.current?.abort();
    } catch {
      /* noop */
    }
    const rec: SpeechRecognitionLike = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let finals = "";
    let interrupted = false;
    rec.onresult = (e) => {
      if (!interrupted) {
        interrupted = true;
        const m2 = interruptSpeech();
        setInterruptMs(m2);
        setFlow("listening");
      }
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r) continue;
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) finals += (finals ? " " : "") + t;
        else interim += t;
      }
      setLive((finals + " " + interim).trim());
    };
    rec.onerror = () => setFlow((f) => (f === "listening" ? "idle" : f));
    rec.onend = () => setFlow((f) => (f === "listening" ? "idle" : f));
    recognitionRef.current = rec;
    setFlow("listening");
    try {
      rec.start();
    } catch {
      /* already running */
    }
  }

  async function submit() {
    if (!currentQ) return;
    const transcript = live.trim();
    if (!transcript) {
      toast.error("Answer first — tap “Answer Viv” and speak, or type below.");
      return;
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
    stopSpeaking();
    const entry = makeVoiceEntry({
      question: currentQ,
      transcript,
      askedAt: askedAtRef.current,
      answeredAt: new Date().toISOString(),
    });
    const nextEntries = [...entries, entry];
    setEntries(nextEntries);
    setFlow("review");

    if (user) {
      try {
        await saveSession({
          id: sessionId,
          title: "Interview with Viv",
          mode: "avatar",
          skills: questions.map((q) => q.skill),
          rounds: nextEntries.map((e) => ({
            question: questions.find((q) => q.id === e.questionId) ?? currentQ,
            answer: e.transcript,
            selected: null,
            result: evaluate(currentQ, e.transcript, null),
            assisted: false,
          })),
          status: index + 1 >= questions.length ? "complete" : "in_progress",
          score: voiceSessionScore(nextEntries),
          assisted: false,
          created_at: new Date().toISOString(),
          draft: { questions, index, voiceEntries: nextEntries },
        });
      } catch {
        toast.error("Answer kept on screen — saving will retry on next answer.");
      }
    }

    if (index + 1 >= questions.length) {
      setIndex((i) => i + 1);
      setFlow("idle");
      return;
    }

    setFlow("thinking");
    const pause = thinkingPauseMs();
    let nextQ: Question | undefined = questions[index + 1];
    if (user) {
      try {
        const { followUp } = await generateFollowUp({
          data: {
            question: {
              id: currentQ.id,
              skill: currentQ.skill,
              prompt: currentQ.prompt,
              concepts: currentQ.concepts,
              hint: currentQ.hint,
            },
            answer: transcript,
            score: entry.score,
          },
        });
        if (followUp && followUp.length > 8) {
          nextQ = {
            id: `${currentQ.id}-viv-followup`,
            skill: currentQ.skill,
            prompt: followUp,
            concepts: currentQ.concepts,
            hint: currentQ.hint,
          };
          const withFollow = [...questions];
          withFollow.splice(index + 1, 0, nextQ);
          setQuestions(withFollow);
        }
      } catch {
        /* planned next question stands */
      }
    }
    window.setTimeout(() => {
      const ni = index + 1;
      setIndex(ni);
      setLive("");
      const q = nextQ ?? questions[ni];
      if (q) ask(q);
    }, pause);
  }

  function begin() {
    if (questions[0]) ask(questions[0]);
  }

  if (!currentQ) {
    const builtRounds = entries.map((e) => {
      const q = questions.find((item) => item.id === e.questionId) ?? questions[0]!;
      return {
        question: q,
        answer: e.transcript,
        selected: null,
        result: evaluate(q, e.transcript, null),
        assisted: false,
      };
    });
    return (
      <FeedbackResultsView
        title="Interview with Viv"
        subtitle={`Completed ${entries.length} turn(s) with Viv`}
        score={voiceSessionScore(entries)}
        skills={[...new Set(questions.map((q) => q.skill))]}
        rounds={builtRounds}
        onPracticeAgain={() => {
          setEntries([]);
          setIndex(0);
          setLive("");
          setFlow("idle");
        }}
        action={
          <div className="row wrap no-print">
            {user && (
              <Button variant="outline" asChild>
                <Link to="/dashboard/$sessionId" params={{ sessionId }}>
                  Saved report
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/voice">Voice studio</Link>
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <>
      <Heading
        eyebrow="Interview with Viv · 3D theater"
        title="Interview with Viv."
        subtitle="Theater-lit 3D interviewer with glass camera PiP, live pulsing subtitles, and 300ms speech barge-in."
        action={
          <div className="row wrap">
            <span className="pill tabular-nums">
              {currentQ ? `Q${index + 1} / ${questions.length}` : "Complete"}
            </span>
            {!user && <span className="pill warning">Guest preview · Sign in to save</span>}
          </div>
        }
      />

      <fieldset className="panel" style={{ marginBottom: 18 }}>
        <div className="row between wrap">
          <div className="row wrap" role="radiogroup" aria-label="Avatar appearance">
            {APPEARANCES.map((a) => (
              <Button
                key={a.id}
                size="sm"
                variant={appearance === a.id ? "default" : "outline"}
                role="radio"
                aria-checked={appearance === a.id}
                onClick={() => setAppearance(a.id)}
              >
                {a.label}
              </Button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={togglePipCam}>
            <Video size={15} /> {pipCamOn ? "Disable PiP camera" : "Enable PiP camera"}
          </Button>
        </div>
        {!speechSupported && (
          <p className="tiny text-muted" style={{ marginTop: 10 }}>
            Speech recognition needs Chrome/Edge; typing answers works in every browser.
          </p>
        )}
      </fieldset>

      {/* THEATER LAYOUT */}
      <div className="viv-theater">
        <div className="viv-spotlight-stage">
          {/* SMALL GLASS PiP USER CAMERA WINDOW */}
          <div className="viv-pip-cam" aria-label="Your camera picture-in-picture window">
            {pipCamOn ? (
              <video ref={pipVideoRef} playsInline muted autoPlay />
            ) : (
              <span>PiP Camera Off</span>
            )}
          </div>

          <AvatarStage appearance={appearance} pose={pose} />

          {/* SUBTITLES BELOW AVATAR + THINKING ANIMATED DOTS */}
          <div
            className={`viv-subtitles-bar ${pose === "speaking" ? "speaking" : ""}`}
            aria-live="polite"
          >
            {pose === "thinking" ? (
              <span className="viv-thinking-pill">
                Viv is thinking
                <span className="viv-thinking-dots" aria-hidden>
                  <span className="viv-dot" />
                  <span className="viv-dot" />
                  <span className="viv-dot" />
                </span>
              </span>
            ) : (
              <span>{currentQ.prompt}</span>
            )}
          </div>
        </div>

        <section className="panel stack">
          <div className="row between wrap">
            <span className="pill">
              {currentQ.skill} ·{" "}
              {flow === "thinking"
                ? "Viv is thinking…"
                : flow === "asking"
                  ? "Viv is speaking…"
                  : flow === "listening"
                    ? "Listening"
                    : "Your turn"}
            </span>
            {interruptMs != null && (
              <span className="tiny text-muted">Barge-in {interruptMs}ms</span>
            )}
          </div>

          <div className="voice-transcript-box" aria-live="polite">
            <span className="tiny text-muted">Your answer (live transcript)</span>
            <p className="small">
              {live || (
                <span className="text-muted">
                  Press “Answer Viv” to speak — you can interrupt Viv mid-sentence.
                </span>
              )}
            </p>
          </div>

          <label>
            Or type / edit response
            <textarea
              value={live}
              onChange={(e) => setLive(e.target.value)}
              rows={4}
              placeholder="Your spoken words appear here."
            />
          </label>

          <div className="session-actions">
            <Button variant="outline" onClick={begin}>
              Hear question
            </Button>
            <Button variant="outline" onClick={startListening}>
              <Mic size={16} /> Answer Viv
            </Button>
            <Button onClick={submit} disabled={flow === "thinking"}>
              {flow === "thinking" ? "Viv is thinking…" : "Submit answer"} <Check size={16} />
            </Button>
          </div>
          <p className="tiny text-muted">
            Viv pauses 1–2s looking down before follow-ups, takes natural gaze breaks, and keeps
            deterministic concept scoring.
          </p>

          {entries.length > 0 && (
            <div className="stack">
              <h3>Answered with Viv</h3>
              {entries.map((e, i) => (
                <article
                  key={e.id}
                  style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}
                >
                  <div className="row between">
                    <span className="pill">
                      Q{i + 1} · {e.skill}
                    </span>
                    <b className="tabular-nums">{e.score}/100</b>
                  </div>
                  <p className="small text-muted" style={{ marginTop: 6 }}>
                    {e.transcript}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
