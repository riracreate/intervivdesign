import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/interviv/workspace";
import { Heading, SkillBar, ArrowRight } from "./ui";
import { toast } from "sonner";
export function Report({ id }: { id: string }) {
  const { sessions, user } = useWorkspace();
  const [tab, setTab] = useState("overview");
  const session = sessions.find((s) => s.id === id);
  if (!user) return <div className="empty">Sign in to view your private session report.</div>;
  if (!session) return <div className="empty">Loading your report…</div>;
  const rounds = session.rounds;
  return (
    <>
      <Heading
        eyebrow="Your practice, made clearer"
        title="Every session has something to teach you."
        subtitle={session.title}
        action={
          <div className="row no-print">
            <Button variant="outline" onClick={() => window.print()}>
              Print / PDF
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href);
                toast.success("Private report link copied. Sign-in is required.");
              }}
            >
              Copy link
            </Button>
          </div>
        }
      />
      <div className="metrics">
        <div className="metric">
          <div className="metric-label">Unassisted score</div>
          <div className="metric-value">
            {session.score ?? "—"}
            <small>{session.score === null ? "" : " /100"}</small>
          </div>
          <p className="metric-note">Rule-based concept estimate</p>
        </div>
        <div className="metric">
          <div className="metric-label">Rounds completed</div>
          <div className="metric-value">{rounds.length}</div>
          <p className="metric-note">
            {session.status === "complete" ? "Session complete" : "Session in progress"}
          </p>
        </div>
        <div className="metric">
          <div className="metric-label">Assisted rounds</div>
          <div className="metric-value">{rounds.filter((r) => r.assisted).length}</div>
          <p className="metric-note">Excluded from readiness</p>
        </div>
      </div>
      <div className="tabs-row no-print">
        {["overview", "rounds", "skills"].map((t) => (
          <Button key={t} variant={tab === t ? "secondary" : "outline"} onClick={() => setTab(t)}>
            {t === "overview"
              ? "Overview & readiness"
              : t === "rounds"
                ? "Round review"
                : "Skills & next steps"}
          </Button>
        ))}
      </div>
      {tab === "overview" && (
        <div className="grid-three">
          <section className="panel stack">
            <span className="pill">Your strength</span>
            <h3>
              {rounds.length
                ? (rounds.slice().sort((a, b) => b.result.score - a.result.score)[0]?.question
                    .skill ?? "Not measured")
                : "A fresh start"}
            </h3>
            <p className="small text-muted">Build on the concepts you covered well.</p>
          </section>
          <section className="panel stack">
            <span className="pill warning">Your next opportunity</span>
            <h3>
              {rounds.length
                ? (rounds.slice().sort((a, b) => a.result.score - b.result.score)[0]?.question
                    .skill ?? "Not measured")
                : "Start your first round"}
            </h3>
            <p className="small text-muted">
              Revisit one missing concept, then explain it with an example.
            </p>
          </section>
          <section className="panel stack">
            <span className="pill">One small next step</span>
            <h3>Keep the momentum.</h3>
            <Button variant="outline" asChild>
              <Link to="/practice">
                Practice again <ArrowRight />
              </Link>
            </Button>
          </section>
        </div>
      )}
      {tab === "rounds" && (
        <div className="stack">
          {rounds.map((r, i) => (
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
              <p className="small">{r.answer || r.question.options?.[r.selected ?? 0]}</p>
              <div className="notice">{r.result.feedback}</div>
              <details>
                <summary>Scoring breakdown</summary>
                {(["correctness", "coverage", "depth", "clarity"] as const).map((k) => (
                  <SkillBar key={k} label={k} value={r.result[k] * 10} note={`${r.result[k]}/10`} />
                ))}
                <p className="tiny text-muted mt-4">
                  Deterministic keyword coverage and structure estimate. No NLP classifier or ML
                  mastery verification.
                </p>
              </details>
            </section>
          ))}
        </div>
      )}
      {tab === "skills" && (
        <section className="panel stack">
          <h2>The skills you worked on</h2>
          {session.skills.map((s) => {
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
          <Button asChild>
            <Link to="/learn">
              Open my learning hub <ArrowRight />
            </Link>
          </Button>
        </section>
      )}
    </>
  );
}
