import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/interviv/workspace";
import { resources, companies, gapSeverity, questions } from "@/lib/interviv/data";
import {
  codingChallenges,
  gradeSqlRows,
  runJavaScriptChallenge,
  sqlChallenges,
  type CodeExecutionResult,
} from "@/lib/interviv/code-runner";
import {
  formatRelativeReview,
  getEffectiveReviewSchedule,
  partitionReviews,
  scheduleReviewItem,
  type ReviewEntry,
} from "@/lib/interviv/spaced-repetition";
import {
  Heading,
  Icon,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  SkillBar,
  Target,
  AuthPrompt,
  Check,
  Play,
  RotateCcw,
} from "./ui";
import { skillScores, Activity } from "./overview";
import { Dashboards } from "./dashboards";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export function Problems() {
  const { data, update, user } = useWorkspace();
  const [arenaMode, setArenaMode] = useState<"coding" | "sql">("coding");
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("All");
  const [bookmarked, setBookmarked] = useState(false);
  const [selected, setSelected] = useState(codingChallenges[0]);
  const [codeByProblem, setCodeByProblem] = useState<Record<string, string>>({});
  const [execResult, setExecResult] = useState<CodeExecutionResult | null>(null);

  const [selectedSql, setSelectedSql] = useState(sqlChallenges[0]);
  const [sqlInput, setSqlInput] = useState(sqlChallenges[0]?.starterSql ?? "");
  const [sqlRows, setSqlRows] = useState<Record<string, unknown>[]>([]);
  const [sqlVerdict, setSqlVerdict] = useState<{ passed: boolean; feedback: string } | null>(null);

  useEffect(() => {
    setExecResult(null);
  }, [selected?.id]);

  if (!selected || !selectedSql) return null;

  const list = codingChallenges.filter(
    (p) =>
      (p.title + " " + p.topics.join(" ")).toLowerCase().includes(search.toLowerCase()) &&
      (difficulty === "All" || p.difficulty === difficulty) &&
      (!bookmarked || data.bookmarks.includes(p.id)),
  );
  const currentCode = codeByProblem[selected.id] ?? selected.code;
  const solvedList = data.solvedProblems ?? [];

  async function handleRunCode() {
    if (!selected) return;
    const result = runJavaScriptChallenge(selected, currentCode);
    setExecResult(result);
    if (result.ok) {
      if (!solvedList.includes(selected.id)) {
        await update({ solvedProblems: [...solvedList, selected.id] });
      }
      toast.success(`All ${result.totalCount} test cases passed.`);
    } else if (result.compileError) {
      toast.error("Syntax or runtime error — check details below.");
    } else {
      toast.info(`${result.passedCount} of ${result.totalCount} test cases passed.`);
    }
  }

  async function handleRunSql() {
    if (!selectedSql) return;
    try {
      const { default: alasql } = await import("alasql");
      const result = alasql(sqlInput, [selectedSql.rows]);
      const rows = Array.isArray(result) ? (result as Record<string, unknown>[]) : [];
      setSqlRows(rows);
      const verdict = gradeSqlRows(rows, selectedSql.expectedRows, selectedSql.orderSensitive);
      setSqlVerdict(verdict);
      if (verdict.passed) {
        if (!solvedList.includes(selectedSql.id)) {
          await update({ solvedProblems: [...solvedList, selectedSql.id] });
        }
        toast.success("SQL query matched expected output.");
      } else {
        toast.info(verdict.feedback);
      }
    } catch (e) {
      setSqlVerdict({
        passed: false,
        feedback: e instanceof Error ? e.message : "SQL syntax error.",
      });
      toast.error(e instanceof Error ? e.message : "SQL query failed.");
    }
  }

  return (
    <>
      <Heading
        eyebrow="Interactive Coding & SQL Arena"
        title="Write, run, and verify your solutions."
        subtitle="Test JavaScript solutions against visible cases and execute live SQL queries in your browser."
        action={
          <div className="tabs-row" style={{ marginBottom: 0 }}>
            <Button
              variant={arenaMode === "coding" ? "secondary" : "outline"}
              onClick={() => setArenaMode("coding")}
            >
              Coding challenges ({codingChallenges.length})
            </Button>
            <Button
              variant={arenaMode === "sql" ? "secondary" : "outline"}
              onClick={() => setArenaMode("sql")}
            >
              SQL sandbox ({sqlChallenges.length})
            </Button>
          </div>
        }
      />

      {arenaMode === "coding" ? (
        <>
          <div className="filters">
            <input
              placeholder="Search problems or topics…"
              aria-label="Search problems"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              {["All", "Easy", "Medium", "Hard"].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <Button
              variant={bookmarked ? "secondary" : "outline"}
              onClick={() => setBookmarked(!bookmarked)}
            >
              <Bookmark /> Bookmarked
            </Button>
          </div>

          <div className="arena-layout">
            <section className="panel">
              <div className="row between mb-3">
                <span className="meta-line">
                  {list.length} of {codingChallenges.length} problems
                </span>
                <span className="meta-line">
                  {solvedList.filter((id) => codingChallenges.some((c) => c.id === id)).length}{" "}
                  solved
                </span>
              </div>
              {list.map((p) => {
                const isSelected = p.id === selected.id;
                const isSolved = solvedList.includes(p.id);
                return (
                  <div className={`problem-row ${isSelected ? "active-row" : ""}`} key={p.id}>
                    <Button
                      variant="ghost"
                      className="problem-select"
                      onClick={() => setSelected(p)}
                    >
                      <div>
                        <strong>
                          {p.title} {isSolved ? "✓" : ""}
                        </strong>
                        <small>
                          {p.difficulty} · {p.topics.join(" · ")}
                        </small>
                      </div>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Bookmark ${p.title}`}
                      title="Bookmark problem"
                      onClick={async () => {
                        if (!user) {
                          toast.info("Sign in to save bookmarks.");
                          return;
                        }
                        await update({
                          bookmarks: data.bookmarks.includes(p.id)
                            ? data.bookmarks.filter((x) => x !== p.id)
                            : [...data.bookmarks, p.id],
                        });
                      }}
                    >
                      <Bookmark fill={data.bookmarks.includes(p.id) ? "currentColor" : "none"} />
                    </Button>
                  </div>
                );
              })}
              {!list.length && <div className="empty">No problems match your filters.</div>}
            </section>

            <section className="panel stack">
              <div className="row between wrap">
                <span className="meta-line">
                  {selected.difficulty} · {selected.topics.join(" · ")} · {selected.complexity}
                </span>
                {solvedList.includes(selected.id) && <span className="pill">Solved</span>}
              </div>
              <h2>{selected.title}</h2>
              <p className="small">{selected.statement}</p>
              <pre className="code-block">{selected.example}</pre>

              <label>
                JavaScript solution ({selected.fnName})
                <textarea
                  className="code-editor"
                  aria-label="JavaScript solution editor"
                  value={currentCode}
                  onChange={(e) =>
                    setCodeByProblem((prev) => ({ ...prev, [selected.id]: e.target.value }))
                  }
                />
              </label>

              <div className="row wrap between">
                <div className="row wrap">
                  <Button onClick={handleRunCode}>
                    <Play size={15} /> Run tests ({selected.tests.length})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCodeByProblem((prev) => ({ ...prev, [selected.id]: selected.code }));
                      setExecResult(null);
                    }}
                  >
                    <RotateCcw size={15} /> Reset starter
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setCodeByProblem((prev) => ({ ...prev, [selected.id]: selected.solution }));
                      setExecResult(null);
                    }}
                  >
                    Load reference
                  </Button>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/practice" search={{ mode: "coding" }}>
                    Timed coding round <ArrowRight />
                  </Link>
                </Button>
              </div>

              <details>
                <summary className="small">Need a hint?</summary>
                <p className="small mt-2 text-muted">{selected.hint}</p>
              </details>

              {execResult && (
                <div className="stack">
                  {execResult.compileError ? (
                    <div className="notice warning">{execResult.compileError}</div>
                  ) : (
                    <>
                      <div
                        className={`notice ${execResult.ok ? "" : "warning"}`}
                        style={{ marginBottom: 0 }}
                      >
                        {execResult.passedCount} / {execResult.totalCount} test cases passed
                      </div>
                      <table className="test-table">
                        <thead>
                          <tr>
                            <th>Test case</th>
                            <th>Expected</th>
                            <th>Actual</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {execResult.results.map((r) => (
                            <tr key={r.id}>
                              <td>{r.label}</td>
                              <td>
                                <code>{JSON.stringify(r.expected)}</code>
                              </td>
                              <td>
                                <code>{r.error ? r.error : JSON.stringify(r.actual)}</code>
                              </td>
                              <td>
                                <span className={`test-status ${r.passed ? "pass" : "fail"}`}>
                                  {r.passed ? `PASS (${r.durationMs}ms)` : "FAIL"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                  {execResult.logs.length > 0 && (
                    <pre className="code-block">
                      Console output:{"\n"}
                      {execResult.logs.join("\n")}
                    </pre>
                  )}
                </div>
              )}
            </section>
          </div>
        </>
      ) : (
        <div className="two-column">
          <section className="panel">
            <div className="meta-line mb-3">{sqlChallenges.length} SQL queries</div>
            {sqlChallenges.map((c) => (
              <div
                key={c.id}
                className={`problem-row ${c.id === selectedSql.id ? "active-row" : ""}`}
              >
                <Button
                  variant="ghost"
                  className="problem-select"
                  onClick={() => {
                    setSelectedSql(c);
                    setSqlInput(c.starterSql);
                    setSqlRows([]);
                    setSqlVerdict(null);
                  }}
                >
                  <div>
                    <strong>
                      {c.title} {solvedList.includes(c.id) ? "✓" : ""}
                    </strong>
                    <small>{c.difficulty} · In-browser AlaSQL</small>
                  </div>
                </Button>
              </div>
            ))}
          </section>

          <section className="panel stack">
            <div className="meta-line">Schema: {selectedSql.schema}</div>
            <h2>{selectedSql.title}</h2>
            <p className="small">{selectedSql.prompt}</p>
            <pre className="code-block">{JSON.stringify(selectedSql.rows, null, 2)}</pre>
            <label>
              SQL Query (use <code>FROM ?</code> for the active table)
              <textarea
                className="code-editor"
                style={{ minHeight: 140 }}
                value={sqlInput}
                onChange={(e) => setSqlInput(e.target.value)}
              />
            </label>
            <div className="row wrap">
              <Button onClick={handleRunSql}>
                <Play size={15} /> Run & grade SQL
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSqlInput(selectedSql.starterSql);
                  setSqlRows([]);
                  setSqlVerdict(null);
                }}
              >
                Reset query
              </Button>
            </div>
            <details>
              <summary className="small">Hint</summary>
              <p className="small mt-2 text-muted">{selectedSql.hint}</p>
            </details>
            {sqlVerdict && (
              <div
                className={`notice ${sqlVerdict.passed ? "" : "warning"}`}
                style={{ marginBottom: 0 }}
              >
                {sqlVerdict.feedback}
              </div>
            )}
            {sqlRows.length > 0 && (
              <pre className="code-block">{JSON.stringify(sqlRows, null, 2)}</pre>
            )}
          </section>
        </div>
      )}
    </>
  );
}

export function Resources() {
  const { data, update } = useWorkspace();
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const studied = data.completedResources ?? [];
  return (
    <>
      <Heading
        eyebrow="Learning Library"
        title="Curated references by skill."
        subtitle="Track what you have studied so your prep stays focused."
      />
      <div className="filters">
        <input
          placeholder="Search a skill or resource…"
          aria-label="Search resources"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="chip-group mb-6">
        {[
          "All",
          "DSA",
          "System design",
          "SQL",
          "Python",
          "TypeScript",
          "React",
          "Backend",
          "Behavioral",
          "Resume / ATS",
        ].map((c) => (
          <Button
            variant="ghost"
            className={`chip ${filter === c ? "selected" : ""}`}
            key={c}
            onClick={() => setFilter(c)}
          >
            {c}
          </Button>
        ))}
      </div>
      <div className="grid-three">
        {resources
          .filter(
            (r) =>
              (filter === "All" || r[0].toLowerCase() === filter.toLowerCase()) &&
              r.join(" ").toLowerCase().includes(search.toLowerCase()),
          )
          .map((r) => {
            const done = studied.includes(r[1]);
            return (
              <article className="panel resource stack" key={r[1]}>
                <div className="row between">
                  <span
                    className={`icon-box ${r[0] === "SQL" ? "peach" : r[0] === "Python" ? "lavender" : "sage"}`}
                  >
                    <Icon name="book" />
                  </span>
                  <span className="meta-line">{r[3]}</span>
                </div>
                <h3>{r[1]}</h3>
                <p>
                  {r[0]} · {r[2]}
                </p>
                <div className="row between wrap">
                  <Button variant="link" className="text-link p-0" asChild>
                    <a href={r[4]} target="_blank" rel="noopener noreferrer">
                      Open guide <ArrowUpRight />
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant={done ? "secondary" : "outline"}
                    onClick={() =>
                      void update({
                        completedResources: done
                          ? studied.filter((x) => x !== r[1])
                          : [...studied, r[1]],
                      })
                    }
                  >
                    <Check size={14} /> {done ? "Studied" : "Mark studied"}
                  </Button>
                </div>
              </article>
            );
          })}
      </div>
    </>
  );
}

const roadmapBenchmarks: Record<string, number> = {
  DSA: 85,
  DBMS: 80,
  OOP: 75,
  "System design": 80,
  Python: 75,
  Behavioral: 70,
  SQL: 80,
  React: 75,
  TypeScript: 75,
  JavaScript: 75,
};
const defaultRoadmapSkills = ["DBMS", "DSA", "OOP", "System design", "Python", "Behavioral"];

export function Roadmap() {
  const { data, sessions, update, user } = useWorkspace();
  const [days, setDays] = useState(14);
  const scores = skillScores(sessions);
  const coachSkills = data.coachPlan?.focusSkills ?? [];
  const resumeMissing = Array.from(
    new Set([
      ...(data.skillGapRoadmap?.missingSkills ?? []),
      ...(data.extractedResume?.jdMatch.missing ?? []),
    ]),
  );
  const candidateSkills = Array.from(
    new Set([...coachSkills, ...resumeMissing, ...defaultRoadmapSkills]),
  );
  const rankedTasks = candidateSkills
    .map((s) => {
      const observed = scores.find((x) => x.skill === s);
      const target = roadmapBenchmarks[s] ?? 75;
      const gap = target - (observed?.score ?? 0);
      const severity = gapSeverity(gap, observed?.attempts ?? 0);
      const isCoach = coachSkills.includes(s);
      const isResumeGap = resumeMissing.includes(s);
      const priority =
        (isCoach ? 1000 : 0) +
        (isResumeGap ? 350 : 0) +
        (severity === "High"
          ? 400 + gap
          : severity === "Medium"
            ? 300 + gap
            : severity === "Untested"
              ? 200
              : 100 + gap);
      return {
        skill: s,
        observed,
        target,
        severity,
        isCoach,
        isResumeGap,
        priority,
        reason: observed
          ? `${severity} gap · ${observed.score}% observed vs ${target}% target`
          : isCoach
            ? `Coach focus · Untested (${target}% target)`
            : isResumeGap
              ? `Resume gap · Missing for ${data.role}`
              : `Untested · 0/3 measured attempts`,
      };
    })
    .sort((a, b) => b.priority - a.priority);
  const tasks = rankedTasks.slice(0, days === 7 ? 3 : days === 14 ? 4 : 6);
  const finished = tasks.filter((t) => data.completed.includes(`${days}-${t.skill}`)).length;
  return (
    <>
      <Heading
        eyebrow="Gap-Driven Study Roadmap"
        title="A study path ordered by your real gaps."
        subtitle={`A ${days}-day plan for ${data.company} · ${data.role}.`}
      />
      {!user && <AuthPrompt />}
      {data.careerHistory && (
        <section
          className="panel row between wrap mb-6"
          aria-label="Imported career history summary"
        >
          <div>
            <div className="eyebrow">Synced from {data.careerHistory.sourceLabel}</div>
            <div className="small" style={{ marginTop: 4 }}>
              <strong>{data.careerHistory.fullName}</strong> — {data.careerHistory.headline} ·{" "}
              {data.careerHistory.roles.length} role(s) &amp;{" "}
              {data.careerHistory.extractedSkills.length} skills imported
            </div>
            {resumeMissing.length > 0 && (
              <div className="tiny text-muted" style={{ marginTop: 4 }}>
                Skill gaps promoted to top priority: {resumeMissing.join(", ")}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/">Update import</Link>
          </Button>
        </section>
      )}
      <div className="row between wrap mb-6">
        <div className="chip-group">
          {[7, 14, 30].map((n) => (
            <Button
              variant="ghost"
              className={`chip ${n === days ? "selected" : ""}`}
              key={n}
              onClick={() => setDays(n)}
            >
              {n} days
            </Button>
          ))}
        </div>
        <span className="meta-line">
          {data.weeklyHours} hrs/week · {finished}/{tasks.length} milestones complete
        </span>
      </div>
      <div className="two-column">
        <section>
          <div className="section-title">
            <h2>Prioritized milestones</h2>
            <span className="meta-line">
              {scores.length || coachSkills.length || resumeMissing.length
                ? "Ordered by skill & resume gaps"
                : "Starter plan"}
            </span>
          </div>
          {tasks.map((t, i) => {
            const s = t.skill;
            const key = `${days}-${s}`;
            const done = data.completed.includes(key);
            return (
              <div className="timeline-row" key={s}>
                <span className="step-number">0{i + 1}</span>
                <div className="full">
                  <div className="row wrap">
                    <span className="meta-line">
                      Days {Math.floor((i * days) / tasks.length) + 1}–
                      {Math.floor(((i + 1) * days) / tasks.length)}
                    </span>
                    <span className={`pill ${t.severity === "High" || t.isCoach ? "warning" : ""}`}>
                      {t.reason}
                    </span>
                  </div>
                  <h3 className="mt-3">
                    {t.severity === "High"
                      ? `Close your ${s} gap.`
                      : t.isCoach
                        ? `Prioritize ${s} from your coach plan.`
                        : t.isResumeGap
                          ? `Build ${s} proof for your resume.`
                          : t.severity === "Untested"
                            ? `Establish a ${s} baseline.`
                            : `Sharpen ${s} further.`}
                  </h3>
                  <p>
                    Focus on {s}. Review one core concept, complete a timed or coached round, and
                    review the trade-offs in your mistakes notebook.
                  </p>
                  <div className="row wrap">
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/practice" search={{ skill: s }}>
                        Practice {s} <ArrowRight />
                      </Link>
                    </Button>
                    <Button
                      variant={done ? "secondary" : "ghost"}
                      size="sm"
                      onClick={async () => {
                        await update({
                          completed: done
                            ? data.completed.filter((x) => x !== key)
                            : [...data.completed, key],
                        });
                      }}
                    >
                      <Check />
                      {done ? "Completed" : "Mark complete"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
        <section className="panel stack">
          <span className="icon-box">
            <Icon name="target" />
          </span>
          <h2>Weekly study budget</h2>
          <p className="small text-muted">
            Adjust hours to keep your weekly commitment sustainable.
          </p>
          <label>
            Weekly study hours: {data.weeklyHours}
            <input
              type="range"
              min={1}
              max={40}
              value={data.weeklyHours}
              onChange={(e) => void update({ weeklyHours: Number(e.target.value) })}
            />
          </label>
          <SkillBar
            label="Plan completion"
            value={Math.round((finished / Math.max(tasks.length, 1)) * 100)}
          />
          {data.coachPlan && (
            <div className="notice stack">
              <strong>Synced from your AI coach</strong>
              <span className="tiny text-muted">{data.coachPlan.summary}</span>
              <ul className="small stack">
                {data.coachPlan.tasks.map((task, idx) => (
                  <li key={idx}>• {task}</li>
                ))}
              </ul>
              <Button variant="outline" size="sm" asChild>
                <Link to="/practice" search={{ skill: data.coachPlan.focusSkills.join(",") }}>
                  Practice coach focus <ArrowRight />
                </Link>
              </Button>
            </div>
          )}
          <Button asChild>
            <Link to="/coach">
              Shape plan with AI coach <ArrowRight />
            </Link>
          </Button>
        </section>
      </div>
    </>
  );
}

export function Learn() {
  const { sessions, data, update } = useWorkspace();
  const [revealedId, setRevealedId] = useState<string | null>(null);

  const mistakes = sessions.flatMap((s) =>
    s.rounds.filter((r) => r.result.score < 60).map((r) => ({ ...r, sessionId: s.id })),
  );

  const existingSchedule: ReviewEntry[] = useMemo(
    () => getEffectiveReviewSchedule(data.reviewSchedule),
    [data.reviewSchedule],
  );

  const { due, upcoming } = useMemo(() => partitionReviews(existingSchedule), [existingSchedule]);
  const weakRetrySkills = Array.from(new Set(mistakes.map((m) => m.question.skill))).slice(0, 3);

  async function recordRecall(entry: ReviewEntry, passed: boolean) {
    const updatedEntry = scheduleReviewItem(
      entry,
      { id: entry.questionId, skill: entry.skill, prompt: entry.prompt, hint: entry.hint },
      passed ? 85 : 40,
    );
    const base = data.reviewSchedule?.length ? data.reviewSchedule : existingSchedule;
    const nextList = [
      ...base.filter((x) => x.questionId !== updatedEntry.questionId),
      updatedEntry,
    ];
    await update({ reviewSchedule: nextList });
    setRevealedId(null);
    toast.success(
      passed
        ? `Scheduled next review (${formatRelativeReview(updatedEntry.nextReviewAt)}).`
        : "Reset to 1-day review so you can reinforce this concept tomorrow.",
    );
  }

  return (
    <>
      <Heading
        eyebrow="Spaced Repetition & Mistakes Notebook"
        title="Retention over cramming."
        subtitle="Active recall reviews follow a 1 → 3 → 7 → 16 → 35 day spacing ladder."
        action={
          weakRetrySkills.length > 0 ? (
            <Button asChild>
              <Link to="/practice" search={{ skill: weakRetrySkills.join(",") }}>
                Practice retry set ({weakRetrySkills.join(", ")}) <ArrowRight />
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="metrics">
        <div className="metric">
          <div className="metric-label">Due for review now</div>
          <div className="metric-value tabular-nums">{due.length}</div>
          <p className="metric-note">Ready for quick active recall</p>
        </div>
        <div className="metric">
          <div className="metric-label">Mistakes notebook</div>
          <div className="metric-value tabular-nums">{mistakes.length}</div>
          <p className="metric-note">Rounds scored under 60%</p>
        </div>
        <div className="metric">
          <div className="metric-label">Scheduled ahead</div>
          <div className="metric-value tabular-nums">{upcoming.length}</div>
          <p className="metric-note">Mastered onto 3–35 day intervals</p>
        </div>
      </div>

      <div className="grid-two">
        <section className="stack">
          <div className="row between">
            <h2>Active recall review queue</h2>
            <span className="meta-line">{due.length} due</span>
          </div>
          {due.length ? (
            due.map((item) => {
              const isOpen = revealedId === item.questionId;
              const fullQ = questions.find((q) => q.id === item.questionId);
              return (
                <article className="panel stack" key={item.questionId}>
                  <div className="row between">
                    <span className="pill">{item.skill}</span>
                    <span className="meta-line">
                      Stage {item.stage + 1}/5 · {formatRelativeReview(item.nextReviewAt)}
                    </span>
                  </div>
                  <h3>{item.prompt}</h3>
                  {!isOpen ? (
                    <Button variant="outline" onClick={() => setRevealedId(item.questionId)}>
                      Reveal hint & concepts
                    </Button>
                  ) : (
                    <div className="stack">
                      <div className="notice" style={{ marginBottom: 0 }}>
                        <strong>Hint:</strong> {item.hint}
                        {fullQ && fullQ.concepts.length > 0 && (
                          <div className="meta-line mt-2">
                            Key terms to mention: {fullQ.concepts.join(" · ")}
                          </div>
                        )}
                      </div>
                      <div className="row wrap">
                        <Button onClick={() => void recordRecall(item, true)}>
                          <Check size={15} /> Recalled cleanly
                        </Button>
                        <Button variant="outline" onClick={() => void recordRecall(item, false)}>
                          Needs another look (1 day)
                        </Button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          ) : (
            <div className="panel empty">
              You are caught up on due reviews. Complete a practice round or check back tomorrow.
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="panel stack">
              <h3>Upcoming spaced reviews</h3>
              {upcoming.map((u) => (
                <div className="row between" key={u.questionId}>
                  <span className="small">
                    <strong>{u.skill}</strong> — {u.prompt.slice(0, 64)}…
                  </span>
                  <span className="meta-line">{formatRelativeReview(u.nextReviewAt)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="stack">
          <h2>Your mistakes notebook</h2>
          {mistakes.length ? (
            mistakes.map((r, i) => (
              <article className="panel stack" key={i}>
                <div className="row between">
                  <span className="pill">{r.question.skill}</span>
                  <span className="pill warning">
                    {r.assisted ? "Assisted" : "Unassisted"} · {r.result.score}%
                  </span>
                </div>
                <h3>{r.question.prompt}</h3>
                <p className="small text-muted">{r.result.feedback}</p>
                <details>
                  <summary className="small">Your answer</summary>
                  <p className="small mt-2">
                    {r.answer ||
                      (typeof r.selected === "number"
                        ? (r.question.options?.[r.selected] ?? "No answer submitted")
                        : "No answer submitted")}
                  </p>
                </details>
                <Button variant="outline" asChild>
                  <Link to="/practice" search={{ skill: r.question.skill }}>
                    Retry {r.question.skill} <ArrowRight />
                  </Link>
                </Button>
              </article>
            ))
          ) : (
            <div className="panel empty">No low-scoring rounds recorded yet.</div>
          )}

          <div className="panel stack">
            <h3>Saved problems ({data.bookmarks.length})</h3>
            {data.bookmarks.map((id) => {
              const p = codingChallenges.find((x) => x.id === id);
              return (
                <div className="problem-row" key={id}>
                  <div>
                    <strong>{p?.title ?? id}</strong>
                    <small>{p?.difficulty}</small>
                  </div>
                  <Button
                    variant="ghost"
                    title="Remove bookmark"
                    size="icon"
                    onClick={() =>
                      void update({ bookmarks: data.bookmarks.filter((x) => x !== id) })
                    }
                  >
                    ×
                  </Button>
                </div>
              );
            })}
            {!data.bookmarks.length && (
              <p className="small text-muted">
                Bookmark problems in the Coding & SQL Arena to see them here.
              </p>
            )}
            <Button variant="outline" asChild>
              <Link to="/problems">
                Open coding arena <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}

export function Progress() {
  const { sessions } = useWorkspace();
  const scores = skillScores(sessions);
  const completed = sessions.filter((s) => s.status === "complete");
  const average = scores.length
    ? Math.round(scores.reduce((a, x) => a + x.score, 0) / scores.length)
    : null;
  const chart = completed
    .slice()
    .reverse()
    .map((s, i) => ({ name: `${i + 1}`, score: s.score ?? 0 }));
  return (
    <>
      <Heading
        eyebrow="Performance Analytics"
        title="Progress grounded in unassisted rounds."
        subtitle="Track readiness trajectory and per-skill Elo ratings over time."
      />
      <div className="two-column">
        <div className="score-display">
          <h2>Role readiness</h2>
          <strong>{average === null ? "—" : `${average}%`}</strong>
          <p>
            {average === null
              ? "Your first unassisted session sets a baseline."
              : "Observed rule-based average, not a hiring prediction."}
          </p>
        </div>
        <section className="panel">
          <div className="row between">
            <h2>Session trend</h2>
            <span className="meta-line">{completed.length} completed</span>
          </div>
          <div className="chart-box">
            {chart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line
                    dataKey="score"
                    stroke="var(--primary)"
                    strokeWidth={3}
                    dot={{ fill: "var(--primary)", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty">Your progress curve will appear after your first session.</div>
            )}
          </div>
        </section>
      </div>
      <div className="grid-two mt-6">
        <section className="panel skill-panel">
          <h2>Skill breakdown</h2>
          {["DSA", "DBMS", "OOP", "Python", "System design", "Behavioral", "React", "SQL"].map(
            (s) => {
              const x = scores.find((item) => item.skill === s);
              return (
                <SkillBar
                  key={s}
                  label={s}
                  value={x?.score ?? 0}
                  note={x ? `${x.score}% · Elo ${x.elo} · ${x.attempts} rounds` : "Not measured"}
                />
              );
            },
          )}
        </section>
        <Activity />
      </div>
      <div className="mt-6">
        <Dashboards />
      </div>
    </>
  );
}

export function GapAnalysis() {
  const { sessions, data } = useWorkspace();
  const scores = skillScores(sessions);
  const gapSkills = ["DSA", "DBMS", "OOP", "System design", "Python", "Behavioral"];
  const gapTargets = [85, 80, 75, 80, 75, 70];
  const rankedGaps = gapSkills
    .map((s, i) => {
      const x = scores.find((item) => item.skill === s);
      const target = gapTargets[i] ?? 75;
      const gap = target - (x?.score ?? 0);
      const severity = gapSeverity(gap, x?.attempts ?? 0);
      const weight =
        severity === "High"
          ? 400 + gap
          : severity === "Medium"
            ? 300 + gap
            : severity === "Untested"
              ? 200
              : 100 + gap;
      return { skill: s, observed: x, target, severity, weight };
    })
    .sort((a, b) => b.weight - a.weight);
  const topGapSkill = rankedGaps[0]?.skill ?? "DSA";
  return (
    <>
      <Heading
        eyebrow="Role Gap Analysis"
        title="Close the gap to your target role."
        subtitle={`${data.company} · ${data.role} · Curated preparation targets`}
      />
      <div className="notice">
        Thin evidence is provisional. Three unassisted attempts per skill establish a reliable
        signal.
        {data.careerHistory && (
          <div className="tiny" style={{ marginTop: 6 }}>
            <strong>Synced {data.careerHistory.sourceLabel}:</strong> Verified in history (
            {data.careerHistory.extractedSkills.slice(0, 8).join(", ") || "none"}) · Target gaps (
            {data.extractedResume?.jdMatch.missing.join(", ") || "none"})
          </div>
        )}
      </div>
      <div className="grid-two">
        <section className="panel">
          <h2>Observed vs. target benchmark</h2>
          {gapSkills.map((s, i) => {
            const x = scores.find((item) => item.skill === s);
            const target = gapTargets[i] ?? 75;
            return (
              <div key={s} className="mb-6">
                <SkillBar
                  label={s}
                  value={x?.score ?? 0}
                  note={x ? `${x.score}% observed` : "Untested"}
                />
                <SkillBar label="Target benchmark" value={target} />
                <div className="row between mt-2">
                  <span className="pill warning">
                    {gapSeverity(target - (x?.score ?? 0), x?.attempts ?? 0)}
                  </span>
                  <div className="row">
                    <span className="meta-line">
                      {(x?.attempts ?? 0) < 3 ? "Provisional · " : ""}
                      {x?.attempts ?? 0}/3 attempts
                    </span>
                    <Link to="/practice" search={{ skill: s }} className="text-link">
                      Practice <ArrowRight />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
        <section className="panel stack">
          <h2>Company target comparison</h2>
          <p className="small text-muted">
            Illustrative readiness comparisons across target company tracks.
          </p>
          {companies.map((c, i) => (
            <div key={c} className="row between">
              <span>{c}</span>
              <span className="meta-line">
                {scores.length
                  ? `${Math.max(0, Math.round(scores.reduce((a, x) => a + x.score, 0) / scores.length) - (i % 3) * 4)}% observed match`
                  : "Not measured"}
              </span>
            </div>
          ))}
          <Button asChild>
            <Link to="/practice" search={{ skill: topGapSkill }}>
              Practice {topGapSkill} next <ArrowRight />
            </Link>
          </Button>
        </section>
      </div>
    </>
  );
}

const curatedRoleBlueprints = [
  {
    role: "Software Engineer",
    company: "Nimbus Commerce",
    skills: ["DSA", "TypeScript", "System design", "DBMS"],
    summary:
      "Full lifecycle product & API engineering with strong algorithmic and data fundamentals.",
  },
  {
    role: "Backend Engineer",
    company: "Cedar Systems",
    skills: ["SQL", "DBMS", "System design", "Backend"],
    summary: "High-throughput services, query indexing, caching, and distributed reliability.",
  },
  {
    role: "Frontend Engineer",
    company: "Studio North",
    skills: ["React", "TypeScript", "JavaScript", "Frontend"],
    summary:
      "Accessible component architecture, state management, and Core Web Vitals optimization.",
  },
  {
    role: "Full-Stack Engineer",
    company: "Beacon Labs",
    skills: ["React", "TypeScript", "SQL", "System design"],
    summary:
      "End-to-end delivery across React UIs, relational schemas, and resilient API contracts.",
  },
  {
    role: "Data Engineer",
    company: "Meridian Data",
    skills: ["Python", "SQL", "DBMS", "Data Engineering"],
    summary: "Batch and streaming pipelines, dimensional modeling, and query performance tuning.",
  },
  {
    role: "ML Engineer",
    company: "Atlas Applied AI",
    skills: ["Python", "Machine Learning", "AI & LLMs", "System design"],
    summary:
      "Model evaluation pipelines, serving latency optimization, and retrieval architectures.",
  },
];

export function Jobs() {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("Bengaluru / Remote");
  const { update, data, sessions } = useWorkspace();
  const resumeSkills = new Set((data.extractedResume?.allSkills ?? []).map((s) => s.toLowerCase()));
  const practicedSkills = new Set(
    skillScores(sessions)
      .filter((s) => s.score >= 60)
      .map((s) => s.skill.toLowerCase()),
  );

  return (
    <>
      <Heading
        eyebrow="Role Blueprints & Skill Match"
        title="Target roles matched to your profile."
        subtitle="Compare curated role requirements against your extracted resume skills and practice history."
      />
      <div className="notice warning">
        Curated role blueprints for interview preparation — live external job feeds are not
        connected.
      </div>
      <div className="filters">
        <input
          aria-label="Search jobs"
          placeholder="Filter by role or skill…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          aria-label="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>
      <div className="grid-three">
        {curatedRoleBlueprints
          .filter((j) =>
            (j.role + " " + j.company + " " + j.skills.join(" "))
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((j) => {
            const matched = j.skills.filter(
              (s) => resumeSkills.has(s.toLowerCase()) || practicedSkills.has(s.toLowerCase()),
            );
            const matchPct = Math.round((matched.length / j.skills.length) * 100);
            const missing = j.skills.filter((s) => !matched.includes(s));
            return (
              <article className="panel stack" key={j.role}>
                <div className="row between">
                  <span className="icon-box">
                    <Target />
                  </span>
                  <span className="pill">{matchPct}% profile match</span>
                </div>
                <div>
                  <h2>{j.role}</h2>
                  <p className="meta-line">
                    {j.company} · {location}
                  </p>
                </div>
                <p className="small text-muted">{j.summary}</p>
                <div className="meta-line">{j.skills.join(" · ")}</div>
                <Button variant="outline" asChild>
                  <Link
                    to="/practice"
                    search={{ skill: (missing.length ? missing : j.skills).slice(0, 3).join(",") }}
                    onClick={() => void update({ role: j.role, company: j.company })}
                  >
                    Prepare for {j.role} <ArrowRight />
                  </Link>
                </Button>
              </article>
            );
          })}
      </div>
    </>
  );
}
