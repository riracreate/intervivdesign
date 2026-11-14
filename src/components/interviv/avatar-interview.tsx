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
import { Heading, ArrowRight, Check, Mic } from "./ui";
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
    },
    [],
  );

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
    // Unlock if onend is swallowed by the browser
    setTimeout(() => {
      if (flowRef.current === "asking") setFlow("idle");
    }, 6000);
  }

  function startListening() {
    if (!currentQ) return;
    // Interruptible speech: kill TTS immediately, Viv switches to listening.
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
      // First user speech while Viv talks = barge-in: guarantee TTS is dead.
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

    if (index + 1 >= questions.length) return;

    // Thinking pause: Viv looks down 1–2s before the adaptive follow-up.
    setFlow("thinking");
    const pause = thinkingPauseMs();
    let nextQ: Question | undefined = questions[index + 1];
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

  if (!user) {
    return (
      <>
        <Heading
          eyebrow="Interview with Viv"
          title="Meet Viv, your interviewer."
          subtitle="A spoken interview with a lip-synced avatar, natural pauses, and adaptive follow-ups."
        />
        <div className="empty">Sign in to interview with Viv and save your transcript.</div>
        <Button asChild>
          <Link to="/auth">
            Sign in <ArrowRight />
          </Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <Heading
        eyebrow="Interview with Viv · 3D avatar"
        title="Interview with Viv."
        subtitle="Viv speaks each question aloud. Start answering at any time — Viv stops talking within 300ms and listens."
        action={
          <span className="pill">
            {currentQ ? `Q${index + 1} / ${questions.length}` : "Complete"}
          </span>
        }
      />

      <fieldset className="panel appearance-picker">
        <legend>Viv&apos;s appearance</legend>
        <div className="row" role="radiogroup" aria-label="Avatar appearance">
          {APPEARANCES.map((a) => (
            <Button
              key={a.id}
              variant={appearance === a.id ? "secondary" : "outline"}
              role="radio"
              aria-checked={appearance === a.id}
              onClick={() => setAppearance(a.id)}
            >
              {a.label}
            </Button>
          ))}
        </div>
        <p className="tiny text-muted">
          Three.js and the Talking Avatar library load only on this route. Voice-only renders no 3D
          at all.
          {!isSpeechRecognitionSupported() &&
            " Speech recognition needs Chrome; typing works everywhere."}
        </p>
      </fieldset>

      <div className="avatar-grid">
        <AvatarStage appearance={appearance} pose={pose} />

        <section className="panel stack">
          {currentQ ? (
            <>
              <span className="pill">
                {currentQ.skill} ·{" "}
                {flow === "thinking"
                  ? "Viv is thinking of a follow-up…"
                  : flow === "asking"
                    ? "Viv is asking…"
                    : "Your turn"}
              </span>
              <h2 className="session-question">{currentQ.prompt}</h2>
              <div className="voice-transcript" aria-live="polite">
                <p className="tiny text-muted">Your answer (live transcript)</p>
                <p>
                  {live || (
                    <span className="text-muted">
                      Press “Answer Viv” — you can interrupt Viv mid-sentence.
                    </span>
                  )}
                </p>
              </div>
              <label>
                Or type / edit
                <textarea
                  value={live}
                  onChange={(e) => setLive(e.target.value)}
                  rows={3}
                  placeholder="Your spoken words appear here."
                />
              </label>
              {interruptMs != null && (
                <p className="tiny text-muted">
                  Last interrupt: TTS stopped in {interruptMs}ms (budget {INTERRUPT_BUDGET_MS}ms) ·
                  Viv switched to listening pose.
                </p>
              )}
              <div className="session-actions">
                <Button variant="outline" onClick={begin}>
                  Hear question
                </Button>
                <Button variant="outline" onClick={startListening}>
                  <Mic size={16} /> Answer Viv (interrupt)
                </Button>
                <Button onClick={submit} disabled={flow === "thinking"}>
                  {flow === "thinking" ? "Viv is thinking…" : "Submit answer"} <Check size={16} />
                </Button>
              </div>
              <p className="tiny text-muted">
                Before each follow-up Viv pauses 1–2s looking down, takes natural gaze breaks, and
                breathes at idle — like a person, not a statue. Scoring stays the disclosed
                deterministic rubric.
              </p>
            </>
          ) : (
            <div className="stack">
              <h2>Interview complete</h2>
              <p>
                Average: <b>{voiceSessionScore(entries) ?? "—"}/100</b> · {entries.length} answers
                with Viv.
              </p>
              <div className="row">
                <Button variant="outline" asChild>
                  <Link to="/voice-playback/$sessionId" params={{ sessionId }}>
                    Replay transcript
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/voice">Voice-only practice</Link>
                </Button>
              </div>
            </div>
          )}

          {entries.length > 0 && (
            <div className="stack">
              <h3>With Viv so far</h3>
              {entries.map((e, i) => (
                <article key={e.id} className="transcript-entry">
                  <div className="row between">
                    <span className="pill">
                      Q{i + 1} · {e.skill}
                    </span>
                    <b>{e.score}/100</b>
                  </div>
                  <p className="small">{e.transcript}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <style>{`
        .avatar-grid{display:grid;grid-template-columns:1fr 1.2fr;gap:16px;align-items:start;margin-top:16px}
        @media(max-width:900px){.avatar-grid{grid-template-columns:1fr}}
        .appearance-picker{margin:0}
        .voice-transcript{background:var(--sidebar);border:1px solid var(--border);border-radius:12px;padding:12px;min-height:64px}
        .transcript-entry{border-top:1px solid var(--border);padding-top:10px}
      `}</style>
    </>
  );
}
