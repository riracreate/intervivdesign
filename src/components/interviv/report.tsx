import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useWorkspace, type Round } from "@/lib/interviv/workspace";
import { Heading, SkillBar, ArrowRight, RotateCcw } from "./ui";
import { RUBRIC_GUIDE, scoreRubric } from "@/lib/interviv/rubric";
import { analyzeCommunication, paceLabel } from "@/lib/interviv/communication";
import { encodeReportCard } from "@/lib/interviv/share";
import { totalXp, trackProgress } from "@/lib/interviv/xp";
import { computeGaugeMetrics } from "@/lib/interviv/landing-and-theme";
import { toast } from "sonner";

export function FeedbackResultsView({
  title,
  score,
  skills,
  rounds,
  subtitle,
  action,
  onPracticeAgain,
}: {
  title: string;
  score: number | null;
  skills: string[];
  rounds: Round[];
  subtitle?: string;
  action?: ReactNode;
  onPracticeAgain?: () => void;
}) {
  const [tab, setTab] = useState("overview");
  const [gaugeFilled, setGaugeFilled] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  useEffect(() => {
    setGaugeFilled(false);
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setGaugeFilled(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [title, score, rounds.length]);

  const unassisted = rounds.filter((r) => !r.assisted);
  const perSkill = Array.from(
    unassisted.reduce((acc, r) => {
      const list = acc.get(r.question.skill) ?? [];
      list.push(r.result.score);
      acc.set(r.question.skill, list);
      return acc;
    }, new Map<string, number[]>()),
  ).map(([skill, scores]) => ({
    skill,
    avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
  }));

  const strongest = perSkill.slice().sort((a, b) => b.avg - a.avg)[0];
  const weakest = perSkill.slice().sort((a, b) => a.avg - b.avg)[0];
  const nextPracticeSkill = weakest?.skill ?? skills[0];
  const gauge = computeGaugeMetrics(score, 64);

  return (
    <>
      <Heading
        eyebrow="Session feedback & results"
        title="Readiness breakdown"
        subtitle={subtitle ?? title}
        action={action}
      />

      {/* BIG READINESS SCORE REVEAL WITH CIRCULAR ANIMATED GAUGE */}
      <section className="report-hero-card" aria-label="Readiness score summary">
        <div
          className="circular-gauge"
          role="img"
          aria-label={`Readiness score ${gauge.clampedScore} out of 100`}
        >
          <svg width="156" height="156" viewBox="0 0 156 156">
            <defs>
              <linearGradient id="indigoGaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="55%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#a5b4fc" />
              </linearGradient>
            </defs>
            <circle cx="78" cy="78" r="64" className="gauge-ring-bg" />
            <circle
              cx="78"
              cy="78"
              r="64"
              className="gauge-ring-fill"
              strokeDasharray={gauge.circumference}
              strokeDashoffset={gaugeFilled ? gauge.dashOffset : gauge.circumference}
            />
          </svg>
          <div className="gauge-center">
            <strong>{score ?? "—"}</strong>
            <span>{score === null ? "Assisted only" : "Readiness %"}</span>
          </div>
        </div>

        <div className="stack">
          <div className="row wrap">
            <span className="pill">{rounds.length} rounds completed</span>
            <span className="pill">
              {rounds.filter((r) => r.assisted).length} assisted excluded
            </span>
          </div>
          <h2>
            {strongest
              ? `Strongest on ${strongest.skill} (${strongest.avg}%)${weakest && weakest.skill !== strongest.skill ? ` · focus next on ${weakest.skill}` : ""}`
              : "Deterministic concept summary"}
          </h2>
          <p className="small text-muted">
            Scores are computed deterministically from concept coverage, structural markers, depth,
            and prompt relevance. Assisted rounds are tracked separately so readiness remains
            honest.
          </p>
          <div className="row wrap no-print">
            {onPracticeAgain ? (
              <Button onClick={onPracticeAgain}>
                <RotateCcw size={15} /> Practice this again
              </Button>
            ) : (
              <Button asChild>
                <Link to="/practice" search={nextPracticeSkill ? { skill: nextPracticeSkill } : {}}>
                  <RotateCcw size={15} /> Practice this again
                </Link>
              </Button>
            )}
            <Button variant="outline" onClick={() => setTranscriptOpen(true)}>
              View full transcript
            </Button>
          </div>
        </div>
      </section>

      <div className="tabs-row no-print">
        {["overview", "rounds", "skills"].map((t) => (
          <Button key={t} variant={tab === t ? "secondary" : "outline"} onClick={() => setTab(t)}>
            {t === "overview"
              ? "Per-question breakdown"
              : t === "rounds"
                ? "Detailed scorecard"
                : "Skills & next steps"}
          </Button>
        ))}
      </div>

      {/* PER-QUESTION BREAKDOWN IN AN ACCORDION WITH ANIMATED RUBRIC BARS */}
      {tab === "overview" && (
        <section className="panel stack">
          <div>
            <h2>Per-question breakdown</h2>
            <p className="tiny text-muted" style={{ marginTop: 4 }}>
              Expand any question to inspect clarity, structure, depth, and relevance rubric bars.
            </p>
          </div>

          <Accordion type="multiple" defaultValue={rounds.length ? ["q-0"] : []}>
            {rounds.map((r, i) => {
              const rubric = scoreRubric(r.question, r.answer);
              const comm = analyzeCommunication({ transcript: r.answer });
              return (
                <AccordionItem key={`${r.question.id}-${i}`} value={`q-${i}`}>
                  <AccordionTrigger>
                    <div className="row between wrap" style={{ width: "100%", paddingRight: 12 }}>
                      <div className="row" style={{ gap: 10 }}>
                        <span className="pill">
                          Q{i + 1} · {r.question.skill}
                        </span>
                        <span className="small" style={{ fontWeight: 600 }}>
                          {r.question.prompt}
                        </span>
                      </div>
                      <b className="tabular-nums" style={{ color: "var(--primary-bright)" }}>
                        {r.result.score}/100 {r.assisted ? "· Assisted" : ""}
                      </b>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="stack" style={{ paddingTop: 6 }}>
                      <div className="voice-transcript-box">
                        <span className="tiny text-muted">Your answer</span>
                        <p className="small">
                          {r.answer ||
                            (typeof r.selected === "number"
                              ? (r.question.options?.[r.selected] ?? "No answer submitted")
                              : "No answer submitted")}
                        </p>
                      </div>
                      <div className="notice" style={{ marginBottom: 0 }}>
                        {r.result.feedback}
                      </div>

                      <div className="grid-two">
                        {RUBRIC_GUIDE.map((g) => {
                          const pct = rubric[g.key] * 10;
                          return (
                            <div key={g.key} className="rubric-bar-row">
                              <div className="row between">
                                <strong className="small">{g.label}</strong>
                                <span className="tiny text-muted tabular-nums">
                                  {rubric[g.key]}/10 ({pct}%)
                                </span>
                              </div>
                              <div className="rubric-bar-track">
                                <div
                                  className="rubric-bar-fill"
                                  style={{ width: gaugeFilled ? `${pct}%` : "0%" }}
                                />
                              </div>
                              <p className="tiny text-muted">{g.looksFor}</p>
                            </div>
                          );
                        })}
                      </div>

                      <p className="tiny text-muted">
                        Fillers: {comm.fillerCount} ({comm.fillerPer100Words} per 100 words) ·{" "}
                        {comm.words} words · {paceLabel(comm.wordsPerMinute)}
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </section>
      )}

      {tab === "rounds" && (
        <div className="stack">
          {rounds.map((r, i) => {
            const rubric = scoreRubric(r.question, r.answer);
            const comm = analyzeCommunication({ transcript: r.answer });
            return (
              <section className="panel stack" key={i}>
                <div className="row between">
                  <span className="pill">
                    Round {i + 1} · {r.question.skill}
                  </span>
                  <b>
                    {r.result.score}/100 {r.assisted ? "· Assisted" : ""}
                  </b>
                </div>
                <h3>{r.question.prompt}</h3>
                <p className="small">
                  {r.answer ||
                    (typeof r.selected === "number"
                      ? (r.question.options?.[r.selected] ?? "No answer submitted")
                      : "No answer submitted")}
                </p>
                <div className="notice">{r.result.feedback}</div>
                <div className="grid-two">
                  {RUBRIC_GUIDE.map((g) => (
                    <SkillBar
                      key={g.key}
                      label={g.label}
                      value={rubric[g.key] * 10}
                      note={`${rubric[g.key]}/10`}
                    />
                  ))}
                </div>
                <p className="tiny text-muted">
                  Fillers: {comm.fillerCount} ({comm.fillerPer100Words} per 100 words) ·{" "}
                  {comm.words} words · {paceLabel(comm.wordsPerMinute)}
                </p>
              </section>
            );
          })}
        </div>
      )}

      {tab === "skills" && (
        <section className="panel stack">
          <h2>The skills you worked on</h2>
          {skills.map((s) => {
            const rs = rounds.filter((r) => r.question.skill === s && !r.assisted);
            const value = rs.length
              ? Math.round(rs.reduce((a, r) => a + r.result.score, 0) / rs.length)
              : 0;
            return (
              <SkillBar
                key={s}
                label={s}
                value={value}
                note={rs.length ? `${value}% · ${rs.length} measured rounds` : "Not measured"}
              />
            );
          })}
          <div className="row wrap">
            <Button asChild>
              <Link to="/practice" search={nextPracticeSkill ? { skill: nextPracticeSkill } : {}}>
                Practice this again <ArrowRight />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/roadmap">See updated roadmap</Link>
            </Button>
          </div>
        </section>
      )}

      {/* FULL TRANSCRIPT DIALOG */}
      <Dialog open={transcriptOpen} onOpenChange={setTranscriptOpen}>
        <DialogContent style={{ maxWidth: 720, maxHeight: "80vh", overflowY: "auto" }}>
          <DialogTitle>Full session transcript</DialogTitle>
          <div className="stack" style={{ marginTop: 8 }}>
            {rounds.map((r, i) => (
              <div
                key={`${r.question.id}-tx-${i}`}
                style={{
                  borderTop: i > 0 ? "1px solid var(--border)" : "none",
                  paddingTop: i > 0 ? 12 : 0,
                }}
              >
                <div className="row between" style={{ marginBottom: 4 }}>
                  <span className="pill">
                    Q{i + 1} · {r.question.skill}
                  </span>
                  <b className="tabular-nums">{r.result.score}/100</b>
                </div>
                <p className="small">
                  <b>Interviewer:</b> {r.question.prompt}
                </p>
                <p className="small text-muted" style={{ marginTop: 6 }}>
                  <b>Your response:</b>{" "}
                  {r.answer ||
                    (typeof r.selected === "number"
                      ? (r.question.options?.[r.selected] ?? "(no response)")
                      : "(no response)")}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function Report({ id }: { id: string }) {
  const { sessions, user, ready, sessionsReady } = useWorkspace();
  if (!ready) return <div className="empty">Loading your workspace…</div>;
  if (!user) return <div className="empty">Sign in to view your private session report.</div>;
  if (!sessionsReady) return <div className="empty">Loading your report…</div>;

  const session = sessions.find((s) => s.id === id);
  if (!session) {
    return (
      <div className="empty stack">
        <p>We couldn’t find this session report.</p>
        <Button asChild>
          <Link to="/practice">
            Start a new session <ArrowRight />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <FeedbackResultsView
      title={session.title}
      subtitle={
        session.draft["timeExpired"]
          ? `${session.title} · Finalized when assessment timer ended`
          : session.title
      }
      score={session.score}
      skills={session.skills}
      rounds={session.rounds}
      action={
        <div className="row wrap no-print">
          <Button variant="outline" onClick={() => window.print()}>
            Print / PDF
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                toast.success("Private report link copied. Sign-in is required.");
              } catch {
                toast.info("Copy this page’s URL from your browser bar to save the link.");
              }
            }}
          >
            Copy link
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const xp = totalXp(sessions);
              const top = trackProgress(sessions)[0];
              const code = encodeReportCard({
                v: 1,
                title: session.title,
                score: session.score,
                skills: session.skills,
                rounds: session.rounds.length,
                date: new Date(session.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
                level: xp.level,
                xp: xp.xp,
                topSkill: top?.skill ?? "—",
              });
              await navigator.clipboard.writeText(
                `${window.location.origin}/report-card?d=${code}`,
              );
              toast.success("Public report card link copied — it carries only this summary.");
            }}
          >
            Share public card
          </Button>
        </div>
      }
    />
  );
}
