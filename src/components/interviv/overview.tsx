import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/interviv/workspace";
import { modes } from "@/lib/interviv/data";
import { getEffectiveReviewSchedule, partitionReviews } from "@/lib/interviv/spaced-repetition";
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
  Check,
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
          No sessions yet. Complete one quick practice round to establish your baseline.{" "}
          <Link to="/practice" className="text-link">
            Start practicing <ArrowRight />
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
  const hasResume = Boolean(data.extractedResume || data.resume.trim().length > 40);
  const hasCompletedSession = sessions.some((s) => s.status === "complete");
  const { due } = partitionReviews(getEffectiveReviewSchedule(data.reviewSchedule));
  const solvedCount = data.solvedProblems?.length ?? 0;
  const date = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const checklist = [
    {
      step: 1,
      title: "Pick your target company & role",
      detail: `${data.company} · ${data.role}`,
      done: Boolean(data.role && data.company),
      action: (
        <Button size="sm" variant="outline" onClick={() => setTargetOpen(true)}>
          Edit target
        </Button>
      ),
    },
    {
      step: 2,
      title: "Extract skills & audit your resume",
      detail: data.extractedResume
        ? `${data.extractedResume.allSkills.length} skills extracted · ${data.extractedResume.score.overall}% alignment`
        : "Upload PDF/TXT or paste resume text to detect skill gaps",
      done: hasResume,
      action: (
        <Button size="sm" variant={hasResume ? "outline" : "default"} asChild>
          <Link to="/resume">
            {hasResume ? "View extractor" : "Open extractor"} <ArrowRight />
          </Link>
        </Button>
      ),
    },
    {
      step: 3,
      title: "Run a baseline mock or coding round",
      detail: hasCompletedSession
        ? `${sessions.filter((s) => s.status === "complete").length} completed session(s)`
        : "15-minute unassisted round sets your skill baseline",
      done: hasCompletedSession,
      action: (
        <Button size="sm" variant={hasCompletedSession ? "outline" : "default"} asChild>
          <Link to="/practice">
            Start practice <ArrowRight />
          </Link>
        </Button>
      ),
    },
    {
      step: 4,
      title: "Follow your gap-prioritized roadmap",
      detail:
        data.completed.length > 0
          ? `${data.completed.length} roadmap milestone(s) completed`
          : "Turn measured gaps into daily study blocks",
      done: data.completed.length > 0,
      action: (
        <Button size="sm" variant="outline" asChild>
          <Link to="/roadmap">
            Open roadmap <ArrowRight />
          </Link>
        </Button>
      ),
    },
  ];
  return (
    <>
      <Heading
        eyebrow={date}
        title="Your interview readiness workspace."
        subtitle={
          user
            ? `Welcome back${user.user_metadata["display_name"] ? `, ${String(user.user_metadata["display_name"]).split(" ")[0]}` : ""}. Follow your readiness checklist or jump straight into practice.`
            : "Audit your resume, run live coding & SQL tests, and practice interviews in one calm workspace."
        }
        action={
          <span className="streak tabular-nums">
            <Flame />
            {days ? `${days} practice day${days === 1 ? "" : "s"}` : "Ready to begin"}
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
              <div className="eyebrow">Recommended next action</div>
              <h2>
                {unfinished
                  ? "Resume your active session."
                  : !hasResume
                    ? "Start with your resume."
                    : "Sharpen your next skill."}
              </h2>
              <p>
                {unfinished
                  ? "Your draft and progress are saved. Pick up right where you left off."
                  : !hasResume
                    ? "Extract skills, spot missing role keywords, and launch tailored practice in seconds."
                    : "Practice mock interviews, live coding tests, SQL queries, or system design."}
              </p>
              <div className="row wrap">
                <Button asChild>
                  {unfinished ? (
                    <Link to="/session/$sessionId" params={{ sessionId: unfinished.id }}>
                      Continue session <ArrowRight />
                    </Link>
                  ) : !hasResume ? (
                    <Link to="/resume">
                      Open resume extractor <ArrowRight />
                    </Link>
                  ) : (
                    <Link to="/practice">
                      Start practicing <ArrowRight />
                    </Link>
                  )}
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/problems">Coding & SQL arena</Link>
                </Button>
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
                  ? "Unassisted sessions set your baseline"
                  : "Deterministic unassisted average"
              }
              icon={<Target />}
            />
            <Metric
              label="Coding challenges"
              value={solvedCount}
              unit=" / 6"
              note={`${due.length} spaced-review item${due.length === 1 ? "" : "s"} due`}
              icon={<Layers />}
            />
            <Metric
              label="Skills measured"
              value={scores.length}
              unit=" / 8"
              note={`${data.extractedResume?.allSkills.length ?? 0} skills found in resume`}
              icon={<Sparkles />}
            />
          </div>
          <section className="mb-6">
            <div className="section-title">
              <h2>Quick readiness path</h2>
              <span className="meta-line">
                {checklist.filter((c) => c.done).length} of {checklist.length} steps complete
              </span>
            </div>
            <div className="readiness-checklist">
              {checklist.map((item) => (
                <div className={`checklist-item ${item.done ? "done" : ""}`} key={item.step}>
                  <div className="row" style={{ flex: 1 }}>
                    <span className="checklist-step">
                      {item.done ? <Check size={15} /> : item.step}
                    </span>
                    <div>
                      <strong className="small">{item.title}</strong>
                      <div className="meta-line">{item.detail}</div>
                    </div>
                  </div>
                  {item.action}
                </div>
              ))}
            </div>
          </section>
          <section>
            <div className="section-title">
              <h2>Platform toolkit</h2>
              <Link to="/practice" className="text-link">
                All practice modes <ArrowRight />
              </Link>
            </div>
            <div className="practice-grid">
              <Link to="/resume" className="practice-card">
                <span className="icon-box">
                  <Icon name="book" />
                </span>
                <h3>Resume Extractor</h3>
                <p>
                  Parse skills, audit action verbs & metrics, and match against job descriptions.
                </p>
                <span className="card-bottom">
                  PDF & text parser
                  <ArrowUpRight />
                </span>
              </Link>
              <Link to="/problems" className="practice-card">
                <span className="icon-box lavender">
                  <Icon name="code" />
                </span>
                <h3>Coding & SQL Arena</h3>
                <p>Write solutions and run visible JavaScript unit tests and live SQL queries.</p>
                <span className="card-bottom">
                  Live test execution
                  <ArrowUpRight />
                </span>
              </Link>
              <Link to="/learn" className="practice-card">
                <span className="icon-box peach">
                  <Icon name="layers" />
                </span>
                <h3>Spaced Repetition</h3>
                <p>Review due concepts on a 1–35 day ladder and retry your weakest rounds.</p>
                <span className="card-bottom">
                  {due.length} due now
                  <ArrowUpRight />
                </span>
              </Link>
            </div>
          </section>
          <Activity />
        </div>
        <div className="home-right">
          <section className="panel target-card">
            <div className="row between">
              <span className="target-title">TARGET ROLE</span>
              <Target size={18} />
            </div>
            <span className="icon-box">
              <Layers />
            </span>
            <h3>{data.role}</h3>
            <p>{data.company}</p>
            <div className="meta-line">{scores.length} of 8 core skills measured</div>
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={() => setTargetOpen(true)}>
                Edit target <ArrowUpRight />
              </Button>
            </div>
          </section>
          <section className="panel skill-panel">
            <div className="row between">
              <h2>Skill snapshot</h2>
              <ChartNoAxesCombined size={17} />
            </div>
            <p>Measured from your unassisted interview & assessment rounds.</p>
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
              Explore full progress <ArrowRight />
            </Link>
          </section>
          <section className="roadmap-teaser">
            <div className="eyebrow">Personalized study plan</div>
            <h3>Your path, ordered by gaps.</h3>
            <p>Automatically prioritizes your weakest measured skills and coach recommendations.</p>
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
