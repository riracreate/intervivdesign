import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/interviv/workspace";
import { modes } from "@/lib/interviv/data";
import {
  getEffectiveReviewSchedule,
  partitionReviews,
  dueTopics,
} from "@/lib/interviv/spaced-repetition";
import { readinessTrend, radarData, streakCalendar, currentStreak } from "@/lib/interviv/analytics";
import { totalXp } from "@/lib/interviv/xp";
import {
  HOW_IT_WORKS_STEPS,
  LANDING_MODES,
  dueTopicPriority,
  interpolateCount,
} from "@/lib/interviv/landing-and-theme";
import {
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
  ChevronDown,
  Mic,
  Video,
  Bot,
  Code2,
  FileText,
} from "./ui";
import { CareerImportCard } from "./career-import-card";

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

function useCountUp(target: number, durationMs = 750): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target <= 0) {
      setVal(0);
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setVal(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = (now - start) / durationMs;
      setVal(interpolateCount(target, progress));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return val;
}

function useRevealOnScroll() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));
    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return ref;
}

function ModeIcon({ id }: { id: (typeof LANDING_MODES)[number]["id"] }) {
  if (id === "voice") return <Mic size={20} />;
  if (id === "camera") return <Video size={20} />;
  if (id === "avatar") return <Bot size={20} />;
  if (id === "coding") return <Code2 size={20} />;
  return <FileText size={20} />;
}

export function Activity() {
  const { sessions } = useWorkspace();
  return (
    <section className="panel activity reveal">
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
  const rootRef = useRevealOnScroll();

  const scores = skillScores(sessions);
  const average = scores.length
    ? Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length)
    : null;
  const completedCount = sessions.filter((s) => s.status === "complete").length;
  const xpSummary = totalXp(sessions);
  const streakNow = currentStreak(sessions);
  const streakDays = streakCalendar(sessions);
  const trend = readinessTrend(sessions);
  const radar = radarData(sessions);

  const countReadiness = useCountUp(average ?? 0);
  const countSessions = useCountUp(completedCount);
  const countXp = useCountUp(xpSummary.xp);
  const countLevel = useCountUp(xpSummary.level);

  const unfinished = sessions.find((s) => s.status === "in_progress");
  const hasResume = Boolean(data.extractedResume || data.resume.trim().length > 40);
  const hasCompletedSession = completedCount > 0;
  const effectiveReviews = getEffectiveReviewSchedule(data.reviewSchedule);
  const { due: reviewDueItems } = partitionReviews(effectiveReviews);
  const sm2Due = dueTopics(Object.values(data.spaced ?? {}));

  const dueChips =
    sm2Due.length > 0
      ? sm2Due.slice(0, 6).map((item) => ({
          id: item.topic,
          topic: item.topic,
          to: "/adaptive" as const,
          ...dueTopicPriority(item.nextDue),
        }))
      : reviewDueItems.slice(0, 6).map((item) => ({
          id: item.questionId,
          topic: `${item.skill} · ${item.questionId}`,
          to: "/learn" as const,
          ...dueTopicPriority(item.nextReviewAt),
        }));

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
      detail: data.careerHistory
        ? `${data.careerHistory.sourceLabel} · ${data.careerHistory.roles.length} role(s), ${data.careerHistory.extractedSkills.length} skills synced`
        : data.extractedResume
          ? `${data.extractedResume.allSkills.length} skills extracted · ${data.extractedResume.score.overall}% alignment`
          : "Upload PDF/CSV, connect LinkedIn, or paste history to detect skill gaps",
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
        ? `${completedCount} completed session(s)`
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

  const firstName = user?.user_metadata["display_name"]
    ? String(user.user_metadata["display_name"]).split(" ")[0]
    : null;

  return (
    <div ref={rootRef}>
      {/* FULL-SCREEN ANIMATED MESH HERO */}
      <section className="ai-hero" aria-label="AI interview practice studio">
        <div className="hero-mesh" aria-hidden="true">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-grid-overlay" />
        </div>

        <div className="ai-hero-inner">
          <span className="ai-hero-tag">
            <Sparkles size={14} /> AI-powered personal interview studio
          </span>
          <h1 className="ai-hero-title">
            Practice interviews with an{" "}
            <span className="hero-gradient-text">AI that talks back</span>
          </h1>
          <p className="ai-hero-sub">
            Rehearse out loud with Voice or Viv, analyze posture locally on camera, solve live
            JavaScript and SQL challenges, and track honest concept mastery in one calm workspace.
          </p>

          {unfinished ? (
            <Link
              to="/session/$sessionId"
              params={{ sessionId: unfinished.id }}
              className="cta-glow"
            >
              Resume active session <ArrowRight size={18} />
            </Link>
          ) : (
            <Link to="/practice" className="cta-glow">
              Start practicing now <ArrowRight size={18} />
            </Link>
          )}
        </div>

        <button
          type="button"
          className="scroll-indicator"
          aria-label="Scroll to modes and dashboard"
          onClick={() => {
            document.getElementById("modes-section")?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <span>Explore 5 modes &amp; dashboard</span>
          <ChevronDown size={18} />
        </button>
      </section>

      {/* 5 INTERVIEW MODES FEATURE GRID */}
      <section id="modes-section" className="reveal" aria-labelledby="modes-heading">
        <div className="section-title">
          <div>
            <div className="eyebrow">5 specialized modes</div>
            <h2 id="modes-heading">Train every part of the interview loop</h2>
          </div>
          <Link to="/practice" className="text-link">
            Custom builder <ArrowRight />
          </Link>
        </div>

        <div className="modes-five-grid">
          {LANDING_MODES.map((mode) => (
            <Link key={mode.id} to={mode.to} className="mode-feature-card">
              <div className="row between">
                <span className="icon-box">
                  <ModeIcon id={mode.id} />
                </span>
                <span className="pill">{mode.badge}</span>
              </div>
              <h3>{mode.title}</h3>
              <p>{mode.description}</p>
              <div className="mode-feature-footer">
                <span>Launch {mode.title.toLowerCase()}</span>
                <ArrowUpRight size={15} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FLOATING 3-STEP HOW IT WORKS */}
      <section className="how-section reveal" aria-labelledby="how-heading">
        <div className="section-title">
          <div>
            <div className="eyebrow">How it works</div>
            <h2 id="how-heading">Three focused steps to steady confidence</h2>
          </div>
        </div>
        <div className="how-grid">
          {HOW_IT_WORKS_STEPS.map((step) => (
            <article key={step.step} className="how-card">
              <span className="how-step-num">0{step.step}</span>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
              <Link to={step.to} className="text-link">
                {step.cta} <ArrowRight />
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* DASHBOARD / HOME WORKSPACE */}
      <section id="dashboard-section" className="reveal" aria-labelledby="dashboard-heading">
        <div className="welcome-banner">
          <div>
            <span className="streak-flame-badge tabular-nums">
              <Flame size={15} />
              {streakNow > 0 ? `${streakNow}-day active streak` : "Start your streak today"}
            </span>
            <h2 id="dashboard-heading">
              {firstName ? `Welcome back, ${firstName}` : "Your readiness command center"}
            </h2>
            <p className="small text-muted" style={{ marginTop: 8, maxWidth: "56ch" }}>
              Targeting <b>{data.role}</b> at <b>{data.company}</b>. Unassisted rounds measure
              deterministic readiness; assisted practice stays separate so progress stays honest.
            </p>
            <div className="row wrap" style={{ marginTop: 16 }}>
              <Button size="sm" onClick={() => setTargetOpen(true)} variant="outline">
                Change target role <ArrowUpRight />
              </Button>
              <Button size="sm" asChild>
                <Link to="/voice">
                  Launch voice studio <Mic size={14} />
                </Link>
              </Button>
            </div>
          </div>

          <div className="heatmap-wrap">
            <div className="row between" style={{ marginBottom: 10 }}>
              <span className="small" style={{ fontWeight: 650 }}>
                12-week practice heatmap
              </span>
              <span className="tiny text-muted tabular-nums">{completedCount} completed</span>
            </div>
            <div
              className="streak-grid"
              role="img"
              aria-label={`Practice heatmap for the last 12 weeks, current streak ${streakNow} days`}
            >
              {streakDays.map((d) => (
                <span
                  key={d.date}
                  className={`streak-cell intensity-${d.intensity}`}
                  title={`${d.date}: ${d.count} session(s)`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 4 COUNT-UP STAT CARDS */}
        <div className="dash-stats-grid">
          <div className="metric">
            <div className="metric-label">
              Readiness score
              <Target size={16} />
            </div>
            <div className="metric-value tabular-nums">
              {average === null ? "—" : `${countReadiness}%`}
            </div>
            <div className="metric-note">
              {average === null ? "Run 1 unassisted round" : "Deterministic unassisted avg"}
            </div>
          </div>

          <div className="metric">
            <div className="metric-label">
              Sessions
              <Layers size={16} />
            </div>
            <div className="metric-value tabular-nums">{countSessions}</div>
            <div className="metric-note">Completed practice loops</div>
          </div>

          <div className="metric">
            <div className="metric-label">
              XP
              <Sparkles size={16} />
            </div>
            <div className="metric-value tabular-nums">{countXp}</div>
            <div className="metric-note">{xpSummary.neededForNext} XP to next level</div>
          </div>

          <div className="metric">
            <div className="metric-label">
              Level
              <ChartNoAxesCombined size={16} />
            </div>
            <div className="metric-value tabular-nums">Lv {countLevel}</div>
            <div className="metric-note">{xpSummary.progressPct}% through current level</div>
          </div>
        </div>

        {/* LINKEDIN OAUTH & CAREER HISTORY FILE UPLOAD -> SKILL-GAP ROADMAP */}
        <CareerImportCard scores={scores} />

        {/* DUE TODAY SPACED-REPETITION TOPICS WITH PRIORITY CHIPS */}
        <section className="panel stack reveal" aria-labelledby="due-today-title">
          <div className="row between wrap">
            <div>
              <h2 id="due-today-title">
                Due today {dueChips.length ? `(${dueChips.length})` : ""}
              </h2>
              <p className="tiny text-muted" style={{ marginTop: 4 }}>
                Spaced-repetition topics prioritized by review urgency (overdue, due today,
                upcoming).
              </p>
            </div>
            <Link to="/learn" className="text-link">
              Open review queue <ArrowRight />
            </Link>
          </div>
          {dueChips.length ? (
            <div className="priority-chips">
              {dueChips.map((chip) => (
                <Link key={chip.id} to={chip.to} className={`priority-chip ${chip.level}`}>
                  <span className="priority-dot" aria-hidden />
                  <span>{chip.topic}</span>
                  <span className="tiny" style={{ opacity: 0.8 }}>
                    · {chip.label}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="small text-muted">
              No reviews due right now. Practice or grade a concept to schedule its next SM-2
              interval.
            </p>
          )}
        </section>

        {/* READINESS TREND LINE CHART & TOPIC RADAR CHART */}
        <div className="dash-charts-grid reveal">
          <section className="panel stack" aria-labelledby="home-trend-title">
            <div className="row between">
              <h3 id="home-trend-title">Readiness trend</h3>
              <span className="pill">{trend.length} completed</span>
            </div>
            <div
              className="chart-box"
              role="img"
              aria-label={`Readiness trend across ${trend.length} completed sessions`}
            >
              {trend.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card-solid)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        color: "var(--foreground)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#6366f1"
                      strokeWidth={3}
                      dot={{ fill: "#818cf8", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: "#818cf8" }}
                      name="Readiness %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty">
                  Complete an unassisted session to plot your readiness curve.{" "}
                  <Link to="/practice" className="text-link">
                    Run first session <ArrowRight />
                  </Link>
                </div>
              )}
            </div>
          </section>

          <section className="panel stack" aria-labelledby="home-radar-title">
            <div className="row between">
              <h3 id="home-radar-title">Topic radar</h3>
              <span className="pill">6 core tracks</span>
            </div>
            <div
              className="chart-box"
              role="img"
              aria-label="Radar chart of measured accuracy across six core topics"
            >
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radar} outerRadius="72%">
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis
                    dataKey="skill"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11.5 }}
                  />
                  <Radar
                    dataKey="score"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.28}
                    name="Accuracy %"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card-solid)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      color: "var(--foreground)",
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* EXISTING WORKSPACE CHECKLIST + TARGET & SKILL SNAPSHOT */}
        <div className="home-grid reveal">
          <div className="home-left">
            <section className="panel">
              <div className="section-title">
                <h2>Readiness checklist</h2>
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
              <p>Measured from your unassisted interview &amp; assessment rounds.</p>
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
              <p>Automatically prioritizes your weakest measured skills and coach notes.</p>
              <Button variant="outline" asChild>
                <Link to="/roadmap">
                  Open my roadmap <ArrowRight />
                </Link>
              </Button>
            </section>
          </div>
        </div>
      </section>

      <TargetDialog open={targetOpen} onOpenChange={setTargetOpen} />
    </div>
  );
}
