import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/interviv/workspace";
import { formatClock, formatDuration, type VoiceEntry } from "@/lib/interviv/voice";
import { Heading, SkillBar, ArrowRight, Volume2 } from "./ui";
import { speakText, stopSpeaking } from "@/lib/interviv/voice";

export function VoicePlayback({ sessionId }: { sessionId: string }) {
  const { sessions, user } = useWorkspace();
  const session = sessions.find((s) => s.id === sessionId);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);

  const entries: VoiceEntry[] = (() => {
    const draft = session?.draft as Record<string, unknown> | undefined;
    const ve = draft?.["voiceEntries"];
    if (Array.isArray(ve)) return ve as VoiceEntry[];
    // Fallback: rebuild from rounds
    return (session?.rounds ?? []).map((r, i) => ({
      id: `${sessionId}-${i}`,
      questionId: r.question.id,
      questionText: r.question.prompt,
      skill: r.question.skill,
      transcript: r.answer,
      score: r.result.score,
      coverage: r.result.coverage,
      depth: r.result.depth,
      clarity: r.result.clarity,
      askedAt: session?.created_at ?? new Date().toISOString(),
      answeredAt: null,
      durationMs: null,
      isFollowUp: r.question.id.includes("followup"),
      parentQuestionId: null,
    }));
  })();

  useEffect(() => () => stopSpeaking(), []);

  function playFrom(idx: number) {
    stopSpeaking();
    setActive(idx);
    setPlaying(true);
    const e = entries[idx];
    if (!e) {
      setPlaying(false);
      return;
    }
    const utter = speakText(`${e.questionText} Your answer: ${e.transcript}`, {
      onEnd: () => {
        if (idx + 1 < entries.length) playFrom(idx + 1);
        else setPlaying(false);
      },
    });
    if (!utter) setPlaying(false);
  }

  if (!user) return <div className="empty">Sign in to replay your voice interview.</div>;
  if (!session && entries.length === 0) {
    return (
      <>
        <Heading
          eyebrow="Voice playback"
          title="Replay your interview."
          subtitle="Transcript with question markers and scores."
        />
        <div className="empty">
          No voice transcript found for this session yet.{" "}
          <Link to="/voice" className="text-link">
            Start a voice interview <ArrowRight />
          </Link>
        </div>
      </>
    );
  }

  const avg = entries.length
    ? Math.round(entries.reduce((a, e) => a + e.score, 0) / entries.length)
    : null;

  return (
    <>
      <Heading
        eyebrow="Voice playback"
        title="Listen back. Learn forward."
        subtitle={session?.title ?? "Voice interview"}
        action={
          <div className="row">
            <Button
              variant="outline"
              onClick={() => {
                stopSpeaking();
                setPlaying(false);
              }}
            >
              Stop
            </Button>
            <Button onClick={() => playFrom(0)} disabled={playing || !entries.length}>
              <Volume2 size={16} /> Replay all
            </Button>
          </div>
        }
      />

      <div className="metrics">
        <div className="metric">
          <div className="metric-label">Answers</div>
          <div className="metric-value">{entries.length}</div>
          <p className="metric-note">Questions answered aloud</p>
        </div>
        <div className="metric">
          <div className="metric-label">Average score</div>
          <div className="metric-value">
            {avg ?? "—"}
            {avg != null ? <small>/100</small> : null}
          </div>
          <p className="metric-note">Deterministic concept estimate</p>
        </div>
        <div className="metric">
          <div className="metric-label">Follow-ups</div>
          <div className="metric-value">{entries.filter((e) => e.isFollowUp).length}</div>
          <p className="metric-note">Adaptive AI probes</p>
        </div>
      </div>

      <div className="playback-layout">
        <section className="panel stack">
          <h3>Timeline</h3>
          <ol className="timeline">
            {entries.map((e, i) => (
              <li key={e.id} className={i === active ? "active" : ""}>
                <button
                  type="button"
                  className="timeline-item"
                  onClick={() => {
                    setActive(i);
                  }}
                >
                  <span className="timeline-dot" aria-hidden />
                  <span>
                    <b>
                      {e.isFollowUp ? "Follow-up" : `Question ${i + 1}`} · {e.skill}
                    </b>
                    <small>
                      {formatClock(e.askedAt)} · {e.score}/100
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {entries.length === 0 && <p className="small text-muted">No entries yet.</p>}
        </section>

        <section className="panel stack" aria-live="polite">
          {entries[active] ? (
            <>
              <div className="row between">
                <span className="pill">
                  {entries[active]!.isFollowUp ? "Adaptive follow-up" : "Interview question"} ·{" "}
                  {entries[active]!.skill}
                </span>
                <b>{entries[active]!.score}/100</b>
              </div>
              <h2>{entries[active]!.questionText}</h2>
              <div className="voice-transcript">
                <p className="tiny text-muted">
                  Your spoken answer · {formatClock(entries[active]!.askedAt)}
                  {entries[active]!.answeredAt
                    ? ` → ${formatClock(entries[active]!.answeredAt!)}`
                    : ""}{" "}
                  · {formatDuration(entries[active]!.durationMs)}
                </p>
                <p>
                  {entries[active]!.transcript || (
                    <em className="text-muted">(no transcript captured)</em>
                  )}
                </p>
              </div>
              <div className="grid-two">
                <SkillBar
                  label="Coverage"
                  value={entries[active]!.coverage * 10}
                  note={`${entries[active]!.coverage}/10`}
                />
                <SkillBar
                  label="Depth"
                  value={entries[active]!.depth * 10}
                  note={`${entries[active]!.depth}/10`}
                />
                <SkillBar
                  label="Clarity"
                  value={entries[active]!.clarity * 10}
                  note={`${entries[active]!.clarity}/10`}
                />
              </div>
              <p className="tiny text-muted">
                Scores use the disclosed deterministic rubric (keyword coverage + structure). No ML
                mastery claim.
              </p>
              <div className="row">
                <Button variant="outline" onClick={() => playFrom(active)}>
                  <Volume2 size={16} /> Hear this Q&A
                </Button>
                <Button
                  variant="outline"
                  disabled={active === 0}
                  onClick={() => setActive(active - 1)}
                >
                  Previous
                </Button>
                <Button
                  disabled={active + 1 >= entries.length}
                  onClick={() => setActive(active + 1)}
                >
                  Next <ArrowRight size={16} />
                </Button>
              </div>
            </>
          ) : (
            <p className="small text-muted">
              Select a question to review its transcript and scores.
            </p>
          )}
        </section>
      </div>

      <div className="row mt-5">
        <Button variant="outline" asChild>
          <Link to="/voice">New voice interview</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/">Back to overview</Link>
        </Button>
      </div>

      <style>{`
        .playback-layout{display:grid;grid-template-columns:300px 1fr;gap:16px;align-items:start}
        @media(max-width:900px){.playback-layout{grid-template-columns:1fr}}
        .timeline{list-style:none;margin:0;padding:0;display:grid;gap:6px}
        .timeline-item{display:flex;gap:10px;align-items:flex-start;width:100%;text-align:left;background:none;border:1px solid transparent;border-radius:10px;padding:8px;cursor:pointer}
        .timeline li.active .timeline-item{border-color:var(--border);background:var(--sidebar)}
        .timeline-dot{width:10px;height:10px;border-radius:50%;background:var(--primary);margin-top:5px;flex:none}
        .timeline-item small{display:block;color:var(--muted-foreground)}
        .voice-transcript{background:var(--sidebar);border:1px solid var(--border);border-radius:12px;padding:12px}
      `}</style>
    </>
  );
}
