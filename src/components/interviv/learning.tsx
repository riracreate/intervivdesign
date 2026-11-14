import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/interviv/workspace";
import { problems, resources, skills, companies, gapSeverity } from "@/lib/interviv/data";
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
  Plus,
} from "./ui";
import { skillScores, Activity } from "./overview";
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
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("All");
  const [bookmarked, setBookmarked] = useState(false);
  const [selected, setSelected] = useState(problems[0]);
  if (!selected) return null;
  const list = problems.filter(
    (p) =>
      (p.title + " " + p.topics.join(" ")).toLowerCase().includes(search.toLowerCase()) &&
      (difficulty === "All" || p.difficulty === difficulty) &&
      (!bookmarked || data.bookmarks.includes(p.id)),
  );
  return (
    <>
      <Heading
        eyebrow="A little challenge. A little growth."
        title="Your coding arena."
        subtitle="Good thinking starts with one problem."
      />
      <div className="notice warning">
        Code execution is unavailable. Browse problems and save solutions as unscored drafts.
      </div>
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
      <div className="two-column">
        <section className="panel">
          <p className="tiny text-muted">
            {list.length} of {problems.length} problems
          </p>
          {list.map((p) => (
            <div className="problem-row" key={p.id}>
              <Button variant="ghost" className="problem-select" onClick={() => setSelected(p)}>
                <div>
                  <strong>{p.title}</strong>
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
          ))}
          {!list.length && <div className="empty">No problems match your filters.</div>}
        </section>
        <section className="panel stack">
          <span className="pill">{selected.difficulty}</span>
          <h2>{selected.title}</h2>
          <p className="small">{selected.statement}</p>
          <h3>Example</h3>
          <pre className="code-block">{selected.example}</pre>
          <h3>Starter code</h3>
          <pre className="code-block">{selected.code}</pre>
          <details>
            <summary>Hint</summary>
            <p className="small mt-3">{selected.hint}</p>
          </details>
          <Button asChild>
            <Link to="/practice" search={{ mode: "coding" }}>
              Practice this problem <ArrowRight />
            </Link>
          </Button>
        </section>
      </div>
    </>
  );
}
export function Resources() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  return (
    <>
      <Heading
        eyebrow="Stay curious. Keep growing."
        title="A little learning goes a long way."
        subtitle="Good resources. Less searching. More understanding."
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
        {["All", "DSA", "System design", "SQL", "Python", "Behavioral", "Resume / ATS"].map((c) => (
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
          .map((r) => (
            <article className="panel resource" key={r[1]}>
              <span
                className={`icon-box ${r[0] === "SQL" ? "peach" : r[0] === "Python" ? "lavender" : "sage"}`}
              >
                <Icon name="book" />
              </span>
              <h3>{r[1]}</h3>
              <p>
                {r[0]} · {r[2]}
              </p>
              <span className="pill">{r[3]}</span>
              <div>
                <Button variant="link" className="text-link p-0" asChild>
                  <a href={r[4]} target="_blank" rel="noopener noreferrer">
                    Open resource <ArrowUpRight />
                  </a>
                </Button>
              </div>
            </article>
          ))}
      </div>
    </>
  );
}
const taskSkills = ["DBMS", "DSA", "OOP", "System design", "Python", "Behavioral"];
export function Roadmap() {
  const { data, update, user } = useWorkspace();
  const [days, setDays] = useState(14);
  const tasks = taskSkills.slice(0, days === 7 ? 3 : days === 14 ? 4 : 6);
  const finished = tasks.filter((s) => data.completed.includes(`${days}-${s}`)).length;
  return (
    <>
      <Heading
        eyebrow="Your next chapter, one day at a time"
        title="A path that’s actually yours."
        subtitle={`A ${days}-day plan for ${data.company} · ${data.role}.`}
      />
      {!user && <AuthPrompt />}
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
        <span className="pill">
          {data.weeklyHours} hours / week · {finished}/{tasks.length} completed
        </span>
      </div>
      <div className="two-column">
        <section>
          <div className="section-title">
            <h2>Your next small steps</h2>
            <span className="tiny text-muted">Plan v1</span>
          </div>
          {tasks.map((s, i) => (
            <div className="timeline-row" key={s}>
              <span className="step-number">0{i + 1}</span>
              <div className="full">
                <span className="pill">
                  Days {Math.floor((i * days) / tasks.length) + 1}–
                  {Math.floor(((i + 1) * days) / tasks.length)}
                </span>
                <h3 className="mt-3">
                  {
                    [
                      "Build a strong foundation.",
                      "Put your thinking into practice.",
                      "Connect the dots.",
                      "See the bigger picture.",
                      "Go a little deeper.",
                      "Tell your story.",
                    ][i]
                  }
                </h3>
                <p>
                  Focus on {s}. Review one core concept, practice a focused question, and reflect on
                  the trade-off.
                </p>
                <div className="row wrap">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/practice">
                      Practice {s} <ArrowRight />
                    </Link>
                  </Button>
                  <Button
                    variant={data.completed.includes(`${days}-${s}`) ? "secondary" : "ghost"}
                    size="sm"
                    onClick={async () => {
                      const key = `${days}-${s}`;
                      await update({
                        completed: data.completed.includes(key)
                          ? data.completed.filter((x) => x !== key)
                          : [...data.completed, key],
                      });
                    }}
                  >
                    <Check />
                    {data.completed.includes(`${days}-${s}`) ? "Completed" : "Mark complete"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </section>
        <section className="panel stack">
          <span className="icon-box">
            <Icon name="target" />
          </span>
          <h2>Make room for progress.</h2>
          <p className="small text-muted">
            A realistic study budget beats a perfect plan you can’t keep.
          </p>
          <label>
            Weekly study hours: {data.weeklyHours}
            <input
              type="range"
              min={1}
              max={40}
              value={data.weeklyHours}
              onChange={(e) => update({ weeklyHours: Number(e.target.value) })}
            />
          </label>
          <SkillBar label="Plan completion" value={Math.round((finished / tasks.length) * 100)} />
          <Button asChild>
            <Link to="/coach">
              Shape my plan with my coach <ArrowRight />
            </Link>
          </Button>
        </section>
      </div>
    </>
  );
}
export function Learn() {
  const { sessions, data, update } = useWorkspace();
  const mistakes = sessions.flatMap((s) =>
    s.rounds.filter((r) => r.result.score < 60).map((r) => ({ ...r, sessionId: s.id })),
  );
  return (
    <>
      <Heading
        eyebrow="Come back a little stronger"
        title="Turn yesterday’s gaps into tomorrow’s growth."
        subtitle="Revisit what matters. Keep the lessons, not just the answers."
      />
      <div className="metrics">
        <div className="metric">
          <div className="metric-label">In your notebook</div>
          <div className="metric-value">{mistakes.length}</div>
          <p className="metric-note">Questions worth another look</p>
        </div>
        <div className="metric">
          <div className="metric-label">Bookmarked problems</div>
          <div className="metric-value">{data.bookmarks.length}</div>
          <p className="metric-note">Your personal practice collection</p>
        </div>
        <div className="metric">
          <div className="metric-label">Review rhythm</div>
          <div className="metric-value">
            1–35<small> days</small>
          </div>
          <p className="metric-note">Build understanding over time</p>
        </div>
      </div>
      <div className="grid-two">
        <section>
          <h2 className="mb-5">Your mistakes notebook</h2>
          {mistakes.length ? (
            mistakes.map((r, i) => (
              <article className="panel stack mb-4" key={i}>
                <div className="row between">
                  <span className="pill">{r.question.skill}</span>
                  <span className="pill warning">
                    {r.assisted ? "Assisted" : "Unassisted"} · {r.result.score}%
                  </span>
                </div>
                <h3>{r.question.prompt}</h3>
                <p className="small text-muted">{r.result.feedback}</p>
                <details>
                  <summary>Hint</summary>
                  <p className="small mt-3">{r.question.hint}</p>
                </details>
                <details>
                  <summary>Your answer</summary>
                  <p className="small mt-3">{r.answer || r.question.options?.[r.selected ?? 0]}</p>
                </details>
                <Button variant="outline" asChild>
                  <Link to="/practice">
                    Try again <ArrowRight />
                  </Link>
                </Button>
              </article>
            ))
          ) : (
            <div className="panel empty">
              No missed questions yet. Start a practice session to discover your next focus.
            </div>
          )}
        </section>
        <section>
          <h2 className="mb-5">Saved for a little later</h2>
          <div className="panel">
            {data.bookmarks.map((id) => {
              const p = problems.find((x) => x.id === id);
              return (
                <div className="problem-row" key={id}>
                  <div>
                    <h3>{p?.title}</h3>
                    <span className="tiny text-muted">{p?.difficulty}</span>
                  </div>
                  <Button
                    variant="ghost"
                    title="Remove bookmark"
                    size="icon"
                    onClick={() => update({ bookmarks: data.bookmarks.filter((x) => x !== id) })}
                  >
                    ×
                  </Button>
                </div>
              );
            })}
            {!data.bookmarks.length && (
              <div className="empty">
                A problem catch your eye? Bookmark it in the coding arena.
              </div>
            )}
            <Button variant="outline" className="full mt-4" asChild>
              <Link to="/problems">
                Explore problems <ArrowRight />
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
        eyebrow="Small steps. Real progress."
        title="Look how far you’re coming."
        subtitle="Your progress, grounded in your practice."
      />
      <div className="two-column">
        <div className="score-display">
          <h2>Your role readiness</h2>
          <strong>{average === null ? "—" : `${average}%`}</strong>
          <p>
            {average === null
              ? "Your first unassisted session sets a baseline."
              : "Observed rule-based average, not a hiring prediction."}
          </p>
        </div>
        <section className="panel">
          <div className="row between">
            <h2>A little better, session by session.</h2>
            <span className="pill">{completed.length} completed</span>
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
          <h2>Your skills, a little clearer.</h2>
          {["DSA", "DBMS", "OOP", "Python", "System design", "Behavioral"].map((s) => {
            const x = scores.find((x) => x.skill === s);
            return (
              <SkillBar
                key={s}
                label={s}
                value={x?.score ?? 0}
                note={x ? `${x.score}% · Elo ${x.elo} · ${x.attempts} rounds` : "Not measured"}
              />
            );
          })}
        </section>
        <Activity />
      </div>
    </>
  );
}
export function GapAnalysis() {
  const { sessions, data } = useWorkspace();
  const scores = skillScores(sessions);
  return (
    <>
      <Heading
        eyebrow="Know what matters next"
        title="Close the gap. Open the next door."
        subtitle={`${data.company} · ${data.role} · Curated preparation targets`}
      />
      <div className="notice">
        Thin evidence is provisional. Three unassisted attempts per skill give a more useful
        picture.
      </div>
      <div className="grid-two">
        <section className="panel">
          <h2>Your skills vs. your target</h2>
          {["DSA", "DBMS", "OOP", "System design", "Python", "Behavioral"].map((s, i) => {
            const x = scores.find((x) => x.skill === s);
            const target = [85, 80, 75, 80, 75, 70][i] ?? 75;
            return (
              <div key={s} className="mb-6">
                <SkillBar
                  label={s}
                  value={x?.score ?? 0}
                  note={x ? `${x.score}% observed` : "Untested"}
                />
                <SkillBar label="Preparation target" value={target} />
                <div className="row between mt-2">
                  <span className="pill warning">
                    {gapSeverity(target - (x?.score ?? 0), x?.attempts ?? 0)}
                  </span>
                  <span className="tiny text-muted">
                    {(x?.attempts ?? 0) < 3 ? "Provisional · " : ""}
                    {x?.attempts ?? 0}/3 measured attempts
                  </span>
                </div>
              </div>
            );
          })}
        </section>
        <section className="panel stack">
          <h2>A wider view of your next chapter.</h2>
          <p className="small text-muted">
            Preparation targets are illustrative, not official company hiring rubrics.
          </p>
          {companies.map((c, i) => (
            <div key={c} className="row between">
              <span>{c}</span>
              <span className="tiny text-muted">
                {scores.length
                  ? `${Math.max(0, Math.round(scores.reduce((a, x) => a + x.score, 0) / scores.length) - (i % 3) * 4)}% observed match`
                  : "Not measured"}
              </span>
            </div>
          ))}
          <Button asChild>
            <Link to="/practice">
              Practice my next gap <ArrowRight />
            </Link>
          </Button>
        </section>
      </div>
    </>
  );
}
export function Jobs() {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("Bengaluru");
  const { update } = useWorkspace();
  const jobs: [string, string, string][] = [
    ["Software Engineer", "Example Labs", "DSA · Python · System design"],
    ["Backend Engineer", "Sample Systems", "SQL · DBMS · Backend"],
    ["Frontend Engineer", "Demo Studio", "React · TypeScript · JavaScript"],
  ];
  return (
    <>
      <Heading
        eyebrow="Find a direction. Make it yours."
        title="Your next role is worth preparing for."
        subtitle="Explore the shape of a role, then turn it into focused practice."
      />
      <div className="notice warning">
        Sample listings — fictional companies. Live job search is not connected.
      </div>
      <div className="filters">
        <input
          aria-label="Search jobs"
          placeholder="Role or skill…"
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
        {jobs
          .filter((j) => j.join(" ").toLowerCase().includes(search.toLowerCase()))
          .map((j) => (
            <article className="panel stack" key={j[0]}>
              <span className="icon-box">
                <Target />
              </span>
              <h2>{j[0]}</h2>
              <p className="small text-muted">
                {j[1]} · {location}
              </p>
              <span className="pill warning">Sample listing</span>
              <p className="small">{j[2]}</p>
              <Button variant="outline" asChild>
                <Link to="/practice" onClick={() => update({ role: j[0], company: j[1] })}>
                  Prepare for this role <ArrowRight />
                </Link>
              </Button>
            </article>
          ))}
      </div>
    </>
  );
}
