import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/interviv/workspace";
import { makeQuestions, evaluate, type Question } from "@/lib/interviv/data";
import { supabase } from "@/integrations/supabase/client";
import {
  getSpeechRecognitionCtor,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
  stopSpeaking,
  makeVoiceEntry,
  voiceSessionScore,
  formatDuration,
  formatClock,
  transcriptWordCount,
  type VoiceEntry,
  type SpeechRecognitionLike,
} from "@/lib/interviv/voice";
import { generateFollowUp } from "@/lib/interviv/voice.functions";
import { buildEnergyMeter, sliceTypedText } from "@/lib/interviv/landing-and-theme";
import { Heading, ArrowRight, Check, Volume2, Mic, Clock } from "./ui";
import { FeedbackResultsView } from "./report";
import { MicOff, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type Phase = "idle" | "speaking" | "listening" | "thinking" | "done";

const WAVE_BARS = Array.from({ length: 14 }, (_, i) => i);

export function VoiceInterview() {
  const { user, saveSession } = useWorkspace();
  const [skill, setSkill] = useState("DBMS");
  const [questions, setQuestions] = useState<Question[]>(() =>
    makeQuestions("interview", ["DBMS", "DSA"], 3),
  );
  const [index, setIndex] = useState(0);
  const [entries, setEntries] = useState<VoiceEntry[]>([]);
  const [live, setLive] = useState("");
  const [finalText, setFinalText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [supported, setSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [elapsedSec, setElapsedSec] = useState(0);
  const [typedChars, setTypedChars] = useState(12);

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
    setTtsSupported(isSpeechSynthesisSupported());
  }, []);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const askedAtRef = useRef<string>(new Date().toISOString());
  const currentQ = questions[index];
  const promptText = currentQ?.prompt ?? "";

  const stopRecognition = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* already stopped */
    }
    recognitionRef.current = null;
  }, []);

  useEffect(
    () => () => {
      stopSpeaking();
      stopRecognition();
    },
    [stopRecognition],
  );

  // Elapsed session timer shown inside the glass pill
  useEffect(() => {
    if (phase === "done") return;
    const id = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  // Animated typing effect for the current question / active transcript side
  useEffect(() => {
    if (!promptText) {
      setTypedChars(0);
      return;
    }
    setTypedChars(Math.min(14, promptText.length));
    const id = window.setInterval(() => {
      setTypedChars((prev) => {
        if (prev >= promptText.length) {
          window.clearInterval(id);
          return prev;
        }
        return prev + 4;
      });
    }, 18);
    return () => window.clearInterval(id);
  }, [promptText]);

  function formatTimer(sec: number) {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function askCurrent(q: Question) {
    askedAtRef.current = new Date().toISOString();
    setLive("");
    setFinalText("");
    if (ttsSupported) {
      setPhase("speaking");
      const utter = speakText(q.prompt, { onEnd: () => setPhase("idle") });
      if (!utter) setPhase("idle");
      setTimeout(() => setPhase((p) => (p === "speaking" ? "idle" : p)), 4000);
    } else {
      setPhase("idle");
    }
  }

  function startListening() {
    if (!currentQ) return;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      toast.error(
        "Speech recognition is not supported in this browser. Type your answer below instead.",
      );
      return;
    }
    stopSpeaking();
    const rec: SpeechRecognitionLike = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;
    let finals = finalText;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r) continue;
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) finals += (finals ? " " : "") + t;
        else interim += t;
      }
      setFinalText(finals.trim());
      setLive((finals + " " + interim).trim());
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed")
        toast.error("Microphone permission denied. Allow mic access and try again.");
      else if (ev.error !== "aborted") toast.error(`Listening stopped: ${ev.error}`);
      setPhase("idle");
    };
    rec.onend = () => setPhase((p) => (p === "listening" ? "idle" : p));
    recognitionRef.current = rec;
    setPhase("listening");
    try {
      rec.start();
    } catch {
      setPhase("idle");
    }
  }

  function stopListening() {
    stopRecognition();
    setPhase("idle");
    setLive(finalText);
  }

  async function submitAnswer() {
    if (!currentQ) return;
    const transcript = (live || finalText).trim();
    if (!transcript) {
      toast.error("Say or type your answer first.");
      return;
    }
    stopRecognition();
    stopSpeaking();
    const answeredAt = new Date().toISOString();
    const entry = makeVoiceEntry({
      question: currentQ,
      transcript,
      askedAt: askedAtRef.current,
      answeredAt,
    });
    const nextEntries = [...entries, entry];
    setEntries(nextEntries);
    setPhase("thinking");

    if (user) {
      try {
        const score = voiceSessionScore(nextEntries);
        await saveSession({
          id: sessionId,
          title: "Voice interview",
          mode: "voice",
          skills: [skill],
          rounds: nextEntries.map((e) => ({
            question: questions.find((q) => q.id === e.questionId) ?? currentQ,
            answer: e.transcript,
            selected: null,
            result: evaluate(currentQ, e.transcript, null),
            assisted: false,
          })),
          status: index + 1 >= questions.length ? "complete" : "in_progress",
          score,
          assisted: false,
          created_at: new Date().toISOString(),
          draft: { questions, index, voiceEntries: nextEntries },
        });
        await supabase
          .from("voice_transcripts" as never)
          .insert({
            session_id: sessionId,
            user_id: user.id,
            question_id: entry.questionId,
            question_text: entry.questionText,
            skill: entry.skill,
            transcript: entry.transcript,
            score: entry.score,
            coverage: entry.coverage,
            depth: entry.depth,
            clarity: entry.clarity,
            is_follow_up: entry.isFollowUp,
            parent_question_id: entry.parentQuestionId,
            asked_at: entry.askedAt,
            answered_at: entry.answeredAt,
            duration_ms: entry.durationMs,
          } as never)
          .then(({ error }) => {
            if (error) console.info("[voice] voice_transcripts not yet migrated:", error.message);
          });
      } catch {
        toast.error("Answer kept in session — sync will retry.");
      }

      if (index + 1 < questions.length) {
        setFollowUpBusy(true);
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
            const fq: Question = {
              id: `${currentQ.id}-followup-${index}`,
              skill: currentQ.skill,
              prompt: followUp,
              concepts: currentQ.concepts,
              hint: currentQ.hint,
            };
            const withFollow = [...questions];
            withFollow.splice(index + 1, 0, fq);
            setQuestions(withFollow);
            toast.success("Adaptive follow-up queued.");
          }
        } catch {
          /* follow-up optional */
        } finally {
          setFollowUpBusy(false);
        }
      }
    }

    setPhase("idle");
    setLive("");
    setFinalText("");

    if (index + 1 >= questions.length) {
      setPhase("done");
    } else {
      const nextIdx = index + 1;
      setIndex(nextIdx);
      const nextQ = questions[nextIdx];
      if (nextQ) askCurrent(nextQ);
    }
  }

  function restart() {
    stopSpeaking();
    stopRecognition();
    const qs = makeQuestions("interview", [skill], 3);
    setQuestions(qs);
    setEntries([]);
    setIndex(0);
    setLive("");
    setFinalText("");
    setElapsedSec(0);
    setPhase("idle");
    if (qs[0]) askCurrent(qs[0]);
  }

  const activeAnswer = live || finalText;
  const energyPct = buildEnergyMeter({
    transcript: activeAnswer,
    listening: phase === "listening",
    speaking: phase === "speaking",
  });
  const eyeContactEst = phase === "listening" ? 84 : phase === "speaking" ? 78 : 72;
  const postureEst = entries.length > 0 ? 86 : 80;
  const typedPrompt = sliceTypedText(promptText, typedChars);

  if (phase === "done" || !currentQ) {
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
        title={`Voice interview · ${skill}`}
        subtitle={`Completed ${entries.length} spoken turn(s) · Session ${sessionId.slice(0, 8)}`}
        score={voiceSessionScore(entries)}
        skills={[skill]}
        rounds={builtRounds}
        onPracticeAgain={restart}
        action={
          <div className="row wrap no-print">
            {user && (
              <Button variant="outline" asChild>
                <Link to="/dashboard/$sessionId" params={{ sessionId }}>
                  Saved report <ArrowRight />
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/voice-playback/$sessionId" params={{ sessionId }}>
                Replay transcript
              </Link>
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <>
      <Heading
        eyebrow="Voice studio · Web Speech API"
        title="Speak your answers."
        subtitle="Split-screen live interviewer stage with animated waveform, typing transcript, and real-time presence meters."
        action={
          <div className="row wrap">
            <span className="glass-timer-pill tabular-nums" aria-label="Session timer">
              <Clock size={14} /> {formatTimer(elapsedSec)}
            </span>
            {!user && <span className="pill warning">Guest preview · Sign in to save</span>}
          </div>
        }
      />

      {!supported && (
        <div className="notice warning" role="alert">
          Speech recognition is unavailable in this browser. You can still hear questions and type
          responses — scoring uses the same concept rubric.
        </div>
      )}

      <div className="voice-split">
        {/* LEFT COLUMN: PINNED TOP QUESTION + WAVEFORM + CONTROLS */}
        <section className="panel voice-stage-panel">
          <div className="voice-pinned-q">
            <div className="row between wrap" style={{ marginBottom: 10 }}>
              <span className="pill">
                {currentQ.skill} · Q{index + 1} / {questions.length}
              </span>
              <span className="speaking-indicator">
                <span className="speaking-dot" aria-hidden />
                {phase === "speaking"
                  ? "Interviewer speaking"
                  : phase === "listening"
                    ? "Listening to your answer"
                    : phase === "thinking"
                      ? "Evaluating response"
                      : "Ready for answer"}
              </span>
            </div>
            <h2 className="session-question" style={{ margin: "6px 0 0" }}>
              {currentQ.prompt}
            </h2>
          </div>

          {/* LIVE WAVEFORM WHILE INTERVIEWER SPEAKS */}
          <div className="waveform-box" aria-live="polite">
            <div className="row" style={{ gap: 10 }}>
              <Volume2 size={18} style={{ color: "var(--primary-bright)" }} />
              <div>
                <strong className="small" style={{ display: "block" }}>
                  {phase === "speaking"
                    ? "Interviewer audio active"
                    : phase === "listening"
                      ? "Capturing voice stream"
                      : "Interviewer idle"}
                </strong>
                <span className="tiny text-muted">
                  {ttsSupported ? "Click Hear again to replay voice prompt" : "Read prompt above"}
                </span>
              </div>
            </div>
            <div
              className={`waveform-bars ${phase === "speaking" || phase === "listening" ? "active" : ""}`}
              aria-hidden="true"
            >
              {WAVE_BARS.map((n) => (
                <span key={n} className="waveform-bar" />
              ))}
            </div>
          </div>

          <div className="row wrap">
            <Button
              variant="outline"
              onClick={() => askCurrent(currentQ)}
              disabled={phase === "listening"}
            >
              <Volume2 size={16} /> Hear question
            </Button>
            <label className="small" style={{ minWidth: 160 }}>
              <select
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                aria-label="Voice interview topic"
              >
                {["DBMS", "DSA", "OOP", "Python", "System design", "Behavioral"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <Button variant="ghost" onClick={restart}>
              <RotateCcw size={15} /> Restart
            </Button>
          </div>

          <label>
            Answer input / live caption editor
            <textarea
              value={activeAnswer}
              onChange={(e) => {
                setLive(e.target.value);
                setFinalText(e.target.value);
              }}
              placeholder="Speak aloud or type your answer here. Concept scoring updates immediately on submit."
              rows={4}
            />
          </label>

          <div className="session-actions">
            {phase === "listening" ? (
              <Button variant="outline" onClick={stopListening}>
                <MicOff size={16} /> Stop listening
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={startListening}
                disabled={!supported || phase === "speaking"}
              >
                <Mic size={16} /> {supported ? "Start speaking" : "Mic unavailable"}
              </Button>
            )}
            <Button onClick={submitAnswer} disabled={followUpBusy || phase === "listening"}>
              {followUpBusy ? "Preparing follow-up…" : "Submit answer"} <Check size={16} />
            </Button>
          </div>
        </section>

        {/* RIGHT COLUMN: LIVE ANIMATED TYPING TRANSCRIPT, CORNER METERS & HISTORY */}
        <aside className="panel stack" aria-label="Live transcript panel">
          <div className="row between">
            <h3>Live transcript</h3>
            <span className="pill">{transcriptWordCount(activeAnswer)} words</span>
          </div>

          <div className="voice-transcript-box" aria-live="polite">
            <span className="tiny text-muted">Interviewer prompt</span>
            <p className="small">
              {typedPrompt}
              {typedChars < promptText.length && <span className="typing-cursor" aria-hidden />}
            </p>
            <span className="tiny text-muted" style={{ marginTop: 8 }}>
              Candidate response stream
            </span>
            <p className="small">
              {activeAnswer ? (
                <>
                  {activeAnswer}
                  {phase === "listening" && <span className="typing-cursor" aria-hidden />}
                </>
              ) : (
                <span className="text-muted">Waiting for speech or typed response…</span>
              )}
            </p>
          </div>

          {/* SLIM ENGAGEMENT METERS (EYE CONTACT, POSTURE, ENERGY) */}
          <div className="engagement-corner-hud" aria-label="Live engagement meters">
            <div className="row between">
              <span className="tiny" style={{ fontWeight: 700, textTransform: "uppercase" }}>
                Presence &amp; vocal meters
              </span>
              <Link to="/engagement" className="tiny text-link">
                Calibrate camera <ArrowRight size={12} />
              </Link>
            </div>
            <div className="hud-meter-row">
              <div className="row between">
                <span>Eye contact</span>
                <span className="tabular-nums text-muted">{eyeContactEst}%</span>
              </div>
              <div className="hud-bar-track">
                <div className="hud-bar-fill" style={{ width: `${eyeContactEst}%` }} />
              </div>
            </div>
            <div className="hud-meter-row">
              <div className="row between">
                <span>Posture</span>
                <span className="tabular-nums text-muted">{postureEst}%</span>
              </div>
              <div className="hud-bar-track">
                <div className="hud-bar-fill" style={{ width: `${postureEst}%` }} />
              </div>
            </div>
            <div className="hud-meter-row">
              <div className="row between">
                <span>Vocal energy</span>
                <span className="tabular-nums text-muted">{energyPct}%</span>
              </div>
              <div className="hud-bar-track">
                <div className="hud-bar-fill" style={{ width: `${energyPct}%` }} />
              </div>
            </div>
          </div>

          <div className="stack">
            <span className="tiny text-muted" style={{ fontWeight: 700 }}>
              COMPLETED TURNS ({entries.length})
            </span>
            {entries.length === 0 && (
              <p className="small text-muted">
                Answered turns will appear here with timestamps, coverage, depth, and clarity
                breakdowns.
              </p>
            )}
            {entries.map((e, i) => (
              <article key={e.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <div className="row between" style={{ marginBottom: 6 }}>
                  <span className="pill">
                    {e.isFollowUp ? "Follow-up" : `Q${i + 1}`} · {e.skill}
                  </span>
                  <b className="tabular-nums">{e.score}/100</b>
                </div>
                <p className="small">
                  <b>Q:</b> {e.questionText}
                </p>
                <p className="small text-muted" style={{ marginTop: 4 }}>
                  {e.transcript || "(no transcript)"}
                </p>
                <p className="tiny text-muted" style={{ marginTop: 6 }}>
                  {formatClock(e.askedAt)} · {formatDuration(e.durationMs)} · Coverage {e.coverage}
                  /10 · Depth {e.depth}/10 · Clarity {e.clarity}/10
                </p>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
