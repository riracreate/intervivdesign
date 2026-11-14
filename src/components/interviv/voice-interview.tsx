import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
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
import { Heading, ArrowRight, Check, Volume2, Mic } from "./ui";
import { MicOff } from "lucide-react";
import { toast } from "sonner";

type Phase = "idle" | "speaking" | "listening" | "thinking" | "done";

export function VoiceInterview() {
  const { user, saveSession } = useWorkspace();
  const nav = useNavigate();
  const [skill, setSkill] = useState("DBMS");
  const [questions, setQuestions] = useState<Question[]>(() =>
    makeQuestions("interview", ["DBMS", "DSA"], 3),
  );
  const [index, setIndex] = useState(0);
  const [entries, setEntries] = useState<VoiceEntry[]>([]);
  const [live, setLive] = useState("");
  const [finalText, setFinalText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [supported] = useState(() => isSpeechRecognitionSupported());
  const [ttsSupported] = useState(() => isSpeechSynthesisSupported());
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const askedAtRef = useRef<string>(new Date().toISOString());
  const currentQ = questions[index];

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

  function askCurrent(q: Question) {
    askedAtRef.current = new Date().toISOString();
    setLive("");
    setFinalText("");
    if (ttsSupported) {
      setPhase("speaking");
      const utter = speakText(q.prompt, { onEnd: () => setPhase("idle") });
      if (!utter) setPhase("idle");
      // Fallback: if onend never fires (some browsers), unlock after 600ms
      setTimeout(() => setPhase((p) => (p === "speaking" ? "idle" : p)), 4000);
    } else {
      setPhase("idle");
    }
  }

  useEffect(() => {
    if (currentQ && phase === "idle" && entries.length === index) {
      // auto-ask on mount / advance (user already clicked Start, so TTS is allowed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    // Persist to practice_sessions (always) + voice_transcripts (when migrated)
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
      if (user) {
        // Best-effort: table is created via Lovable DDL (see db-tables.ts).
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
      }
    } catch {
      toast.error("Answer saved locally — sync will retry.");
    }

    // Adaptive follow-up via AI gateway (authenticated server fn)
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
          toast.success("Follow-up ready — listen, then answer.");
        }
      } catch {
        // Follow-up is optional; continue with the planned next question.
      } finally {
        setFollowUpBusy(false);
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
    setPhase("idle");
    if (qs[0]) askCurrent(qs[0]);
  }

  if (!user) {
    return (
      <>
        <Heading
          eyebrow="Voice interview"
          title="Hear the question. Say your answer."
          subtitle="Spoken practice with live transcript and adaptive follow-ups."
        />
        <div className="empty">Sign in to start a voice interview and save your transcript.</div>
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
        eyebrow="Voice interview · Web Speech API"
        title="Speak your answers."
        subtitle="Questions are read aloud. Your spoken answers are transcribed live and scored with the disclosed concept rubric."
        action={<span className="pill">Session {sessionId.slice(0, 8)}</span>}
      />

      {!supported && (
        <div className="notice warning" role="alert">
          Speech recognition is not available in this browser (try Chrome). You can still hear
          questions and type answers — scoring works the same.
        </div>
      )}
      {!ttsSupported && (
        <div className="notice">Text-to-speech is unavailable; read each question on screen.</div>
      )}

      <div className="voice-grid">
        <section className="panel stack">
          <div className="row between">
            <span className="pill">
              {currentQ ? `${currentQ.skill} · Q${index + 1} / ${questions.length}` : "Complete"}
            </span>
            <span className={`pill ${phase === "listening" ? "warning" : ""}`}>
              {phase === "speaking"
                ? "Interviewer speaking…"
                : phase === "listening"
                  ? "● Listening"
                  : phase === "thinking"
                    ? "Thinking…"
                    : phase === "done"
                      ? "Done"
                      : "Ready"}
            </span>
          </div>

          {currentQ ? (
            <>
              <h2 className="session-question">{currentQ.prompt}</h2>
              <div className="row">
                <Button
                  variant="outline"
                  onClick={() => askCurrent(currentQ)}
                  disabled={phase === "listening"}
                >
                  <Volume2 size={16} /> Hear question again
                </Button>
                <label className="small">
                  Topic{" "}
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
                  Restart set
                </Button>
              </div>

              <div className="voice-transcript" aria-live="polite">
                <p className="tiny text-muted">Live transcript</p>
                <p>
                  {live || finalText || (
                    <span className="text-muted">Press “Start speaking” and answer out loud…</span>
                  )}
                </p>
                {(live || finalText) && (
                  <p className="tiny text-muted">{transcriptWordCount(live || finalText)} words</p>
                )}
              </div>

              <label>
                Or type / edit your answer
                <textarea
                  value={live || finalText}
                  onChange={(e) => {
                    setLive(e.target.value);
                    setFinalText(e.target.value);
                  }}
                  placeholder="Your spoken words appear here. You can edit before submitting."
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
              <p className="tiny text-muted">
                Scoring is a deterministic concept-coverage estimate (see rubric on your report).
                Follow-ups are generated by the AI coach; they never change your score formula.
              </p>
            </>
          ) : (
            <div className="stack">
              <h2>Interview complete</h2>
              <p>
                Average score: <b>{voiceSessionScore(entries) ?? "—"}/100</b> across{" "}
                {entries.length} answers.
              </p>
              <div className="row">
                <Button onClick={restart}>Practice again</Button>
                <Button variant="outline" asChild>
                  <Link to="/voice-playback/$sessionId" params={{ sessionId }}>
                    Replay transcript <ArrowRight />
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </section>

        <aside className="panel stack">
          <h3>Transcript so far</h3>
          {entries.length === 0 && (
            <p className="small text-muted">
              Your answered questions will appear here with timestamps and scores.
            </p>
          )}
          {entries.map((e, i) => (
            <article key={e.id} className="transcript-entry">
              <div className="row between">
                <span className="pill">
                  {e.isFollowUp ? "Follow-up" : `Q${i + 1}`} · {e.skill}
                </span>
                <b>{e.score}/100</b>
              </div>
              <p className="small">
                <b>Q:</b> {e.questionText}
              </p>
              <p className="small">
                {e.transcript || <em className="text-muted">(no transcript)</em>}
              </p>
              <p className="tiny text-muted">
                Asked {formatClock(e.askedAt)} · Answered{" "}
                {e.answeredAt ? formatClock(e.answeredAt) : "—"} · {formatDuration(e.durationMs)} ·
                Coverage {e.coverage}/10 · Depth {e.depth}/10 · Clarity {e.clarity}/10
              </p>
            </article>
          ))}
          {entries.length > 0 && (
            <Button variant="outline" asChild>
              <Link to="/voice-playback/$sessionId" params={{ sessionId }}>
                Open playback view <ArrowRight />
              </Link>
            </Button>
          )}
        </aside>
      </div>

      <style>{`
        .voice-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:16px;align-items:start}
        @media(max-width:900px){.voice-grid{grid-template-columns:1fr}}
        .voice-transcript{background:var(--sidebar);border:1px solid var(--border);border-radius:12px;padding:12px;min-height:72px}
        .transcript-entry{border-top:1px solid var(--border);padding-top:10px}
      `}</style>
    </>
  );
}
