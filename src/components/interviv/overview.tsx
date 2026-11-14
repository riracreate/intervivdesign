import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/interviv/workspace";
import { modes } from "@/lib/interviv/data";
import stillLife from "@/assets/practice-still-life.jpg";
import {
  Heading,
  Metric,
  SkillBar,
  Icon,
  TargetDialog,
  ArrowRight,
  ArrowUpRight,
  Flame,
  Target,
  Layers,
  Sparkles,
  ChartNoAxesCombined,
} from "./ui";
export function skillScores(sessions: ReturnType<typeof useWorkspace>["sessions"]) {
  const map = new Map<string, number[]>();
  for (const s of sessions)
    for (const r of s.rounds) {
      if (r.assisted) continue;
      const prev = map.get(r.question.skill) ?? [];
      map.set(r.question.skill, [...prev, r.result.score]);
    }
  return Array.from(map.entries()).map(([skill, values]) => ({
    skill,
    score: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    attempts: values.length,
    elo: 1200 + Math.round(values.reduce((a, b) => a + (b - 50) / 5, 0)),
  }));
}
export function Activity() {
  const { sessions } = useWorkspace();
  return (
    <section className="activity">
      <div className="section-title">
        <h2>Recent practice</h2>
        <Link to="/progress" className="text-link">
          View progress <ArrowRight />
        </Link>
      </div>
      <table className="activity-table">
        <thead>
          <tr>
            <th>Session</th>
            <th>When</th>
            <th>Score</th>
            <th>Review</th>
          </tr>
        </thead>
        <tbody>
          {sessions.slice(0, 5).map((s) => (
            <tr key={s.id}>
              <td>
                <div className="row">
                  <span className="icon-box">
                    <Icon name={modes.find((m) => m.id === s.mode)?.icon ?? "mic"} />
                  </span>
                  <div>
                    <b>{s.title}</b>
                    <small>
                      {s.skills.join(" · ")} · {s.rounds.length} rounds
                    </small>
                  </div>
                </div>
              </td>
              <td className="text-muted">
                {new Date(s.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </td>
              <td className="score">
                {s.score ?? "—"}
                <small>
                  {s.assisted
                    ? "Practiced with help"
                    : s.status === "complete"
                      ? "/100"
                      : "In progress"}
                </small>
              </td>
              <td>
                <Link to="/dashboard/$sessionId" params={{ sessionId: s.id }} className="text-link">
                  Review <ArrowUpRight />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!sessions.length && (
        <div className="empty">
          Your first session is the start of your story.
          <br />
          <Link to="/practice" className="text-link">
            Find your practice <ArrowRight />
          </Link>
        </div>
      )}
    </section>
  );
}
export function Overview() {
  const { user, data, sessions } = useWorkspace();
  const [targetOpen, setTargetOpen] = useState(false);
  const scores = skillScores(sessions);
  const average = scores.length
    ? Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length)
    : null;
  const days = new Set(
    sessions.filter((s) => s.status === "complete").map((s) => s.created_at.slice(0, 10)),
  ).size;
  const unfinished = sessions.find((s) => s.status === "in_progress");
  const date = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <>
      <Heading
        eyebrow={date}
        title="A little better, every day."
        subtitle={
          user
            ? `Welcome back${user.user_metadata["display_name"] ? `, ${String(user.user_metadata["display_name"]).split(" ")[0]}` : ""}. Let’s make your next step count.`
            : "Your next chapter starts here. Let’s make your next step count."
        }
        action={
          <span className="streak">
            <Flame />
            {days ? `${days} practice days` : "A fresh start"}
          </span>
        }
      />
      <div className="home-grid">
        <div className="home-left">
          <section className="next-session">
            <img
              src={stillLife}
              alt="Microphone, practice cards and a green checkmark"
              width={1152}
              height={576}
            />
            <div className="next-session-text">
              <div className="eyebrow">Your next best step</div>
              <h2>
                Big confidence.
                <br />
                One small session.
              </h2>
              <p>
                {unfinished
                  ? "Pick up where you left off. Your practice is waiting."
                  : "Build on your knowledge with a focused technical interview."}
              </p>
              <div className="row">
                <Button asChild>
                  {unfinished ? (
                    <Link to="/session/$sessionId" params={{ sessionId: unfinished.id }}>
                      Continue practice <ArrowRight />
                    </Link>
                  ) : (
                    <Link to="/practice">
                      Start practicing <ArrowRight />
                    </Link>
                  )}
                </Button>
                <span className="tiny text-muted">~15 min · At your pace</span>
              </div>
            </div>
          </section>
          <div className="metrics">
            <Metric
              label="Role readiness"
              value={average ?? "—"}
              unit={average === null ? "" : "%"}
              note={
                average === null
                  ? "Your first session sets a baseline"
                  : "Based on unassisted practice"
              }
              icon={<Target />}
            />
            <Metric
              label="Practice sessions"
              value={sessions.length}
              note={sessions.length ? "Every session is a step forward" : "Your next small step"}
              icon={<Layers />}
            />
            <Metric
              label="Skills explored"
              value={scores.length}
              unit=" / 8"
              note={`${Math.max(0, 8 - scores.length)} to explore for your target`}
              icon={<Sparkles />}
            />
          </div>
          <section>
            <div className="section-title">
              <h2>Find your flow</h2>
              <Link to="/practice" className="text-link">
                All practice <ArrowRight />
              </Link>
            </div>
            <div className="practice-grid">
              {modes.slice(0, 3).map((m) => (
                <Link to="/practice" search={{ mode: m.id }} className="practice-card" key={m.id}>
                  <span className={`icon-box ${m.tone}`}>
                    <Icon name={m.icon} />
                  </span>
                  <h3>
                    {m.id === "coding" ? "Coding & ML" : m.id === "oa" ? "OA & SQL" : m.title}
                  </h3>
                  <p>{m.description}</p>
                  <span className="card-bottom">
                    {m.time}
                    <ArrowUpRight />
                  </span>
                </Link>
              ))}
            </div>
          </section>
          <Activity />
        </div>
        <div className="home-right">
          <section className="panel target-card">
            <div className="row between">
              <span className="target-title">THE ROLE YOU’RE WORKING TOWARD</span>
              <Target size={18} />
            </div>
            <span className="icon-box">
              <Layers />
            </span>
            <h3>{data.role}</h3>
            <p>{data.company} · Your next chapter</p>
            <span className="pill">
              <span className="dot" />
              {scores.length} of 8 skills explored
            </span>
            <div>
              <Button variant="link" className="text-link p-0" onClick={() => setTargetOpen(true)}>
                Edit your target <ArrowUpRight />
              </Button>
            </div>
          </section>
          <section className="panel skill-panel">
            <div className="row between">
              <h2>Your skill snapshot</h2>
              <ChartNoAxesCombined size={17} />
            </div>
            <p>A clearer picture of where you stand.</p>
            {["DSA", "DBMS", "OOP", "System design"].map((s) => {
              const score = scores.find((x) => x.skill === s);
              return (
                <SkillBar
                  key={s}
                  label={
                    {
                      DSA: "Data structures",
                      DBMS: "Database systems",
                      OOP: "Object-oriented design",
                      "System design": "System design",
                    }[s] ?? s
                  }
                  value={score?.score ?? 0}
                  note={score ? `${score.score}%` : "Not measured"}
                />
              );
            })}
            <Link to="/progress" className="text-link">
              Explore your progress <ArrowRight />
            </Link>
          </section>
          <section className="roadmap-teaser">
            <div className="eyebrow">A little structure goes a long way</div>
            <h3>Your path, one day at a time.</h3>
            <p>A focused plan to close the gap between where you are and where you want to be.</p>
            <Button variant="outline" asChild>
              <Link to="/roadmap">
                Open my roadmap <ArrowRight />
              </Link>
            </Button>
          </section>
        </div>
      </div>
      <TargetDialog open={targetOpen} onOpenChange={setTargetOpen} />
    </>
  );
}
