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
import { useWorkspace } from "@/lib/interviv/workspace";
import {
  readinessTrend,
  radarData,
  streakCalendar,
  currentStreak,
  weakAreaHeat,
  heatColor,
} from "@/lib/interviv/analytics";
import { trackProgress, totalXp } from "@/lib/interviv/xp";
import { SkillBar } from "./ui";

export function Dashboards() {
  const { sessions } = useWorkspace();
  const trend = readinessTrend(sessions);
  const radar = radarData(sessions);
  const streak = streakCalendar(sessions);
  const streakNow = currentStreak(sessions);
  const heat = weakAreaHeat(sessions);
  const tracks = trackProgress(sessions);
  const total = totalXp(sessions);

  return (
    <div className="stack dashboards">
      <div className="grid-two-dash">
        <section className="panel stack" aria-labelledby="trend-title">
          <div className="row between">
            <h3 id="trend-title">Readiness trend</h3>
            <span className="pill">{trend.length} completed sessions</span>
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
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line
                    dataKey="score"
                    stroke="var(--primary)"
                    strokeWidth={3}
                    dot={{ fill: "var(--primary)", r: 4 }}
                    name="Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty">Complete a session to start your trend.</div>
            )}
          </div>
          <p className="tiny text-muted">
            Unassisted sessions only; deterministic concept estimates, not hiring predictions.
          </p>
        </section>

        <section className="panel stack" aria-labelledby="radar-title">
          <h3 id="radar-title">Topic radar</h3>
          <div
            className="chart-box"
            role="img"
            aria-label="Radar of accuracy across six core topics"
          >
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar} outerRadius="70%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
                <Radar
                  dataKey="score"
                  stroke="var(--primary)"
                  fill="var(--primary)"
                  fillOpacity={0.25}
                  name="Accuracy %"
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <p className="tiny text-muted">
            Per-topic accuracy from unassisted rounds (0 = not yet measured).
          </p>
        </section>
      </div>

      <div className="grid-two-dash">
        <section className="panel stack" aria-labelledby="streak-title">
          <div className="row between">
            <h3 id="streak-title">Streak calendar</h3>
            <span className="pill">{streakNow}-day streak</span>
          </div>
          <div
            className="streak-grid"
            role="img"
            aria-label={`Practice activity over the last 12 weeks, current streak ${streakNow} days`}
          >
            {streak.map((d) => (
              <span
                key={d.date}
                className={`streak-cell intensity-${d.intensity}`}
                title={`${d.date}: ${d.count} session(s)`}
              />
            ))}
          </div>
          <p className="tiny text-muted">Last 12 weeks · darker = more sessions that day.</p>

          <h3>Weak-area heat map</h3>
          {heat.length === 0 && (
            <p className="small text-muted">No measured skills yet — finish an unassisted round.</p>
          )}
          <div className="heat-grid">
            {heat.map((c) => (
              <div
                key={c.skill}
                className="heat-cell"
                style={{ borderTopColor: heatColor(c.accuracy) }}
              >
                <b>{c.skill}</b>
                <span>
                  {c.accuracy == null ? "Untested" : `${c.accuracy}% · ${c.attempts} rounds`}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel stack" aria-labelledby="xp-title">
          <div className="row between">
            <h3 id="xp-title">XP & levels</h3>
            <span className="pill">
              Level {total.level} · {total.xp} XP
            </span>
          </div>
          <SkillBar
            label={`Level ${total.level} progress`}
            value={total.progressPct}
            note={`${total.neededForNext} XP to level ${total.level + 1}`}
          />
          {tracks.length === 0 && (
            <p className="small text-muted">
              Answer questions to earn XP per skill track. Assisted rounds earn reduced XP and never
              affect readiness.
            </p>
          )}
          {tracks.map((t) => (
            <div key={t.skill} className="stack">
              <SkillBar
                label={`${t.skill} · Lv ${t.level}`}
                value={t.progressPct}
                note={`${t.xp} XP · ${t.rounds} rounds`}
              />
            </div>
          ))}
          <p className="tiny text-muted">
            XP rewards effort and accuracy; readiness above stays unassisted-only.
          </p>
        </section>
      </div>

      <style>{`
        .grid-two-dash{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
        @media(max-width:900px){.grid-two-dash{grid-template-columns:1fr}}
        .streak-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:4px}
        .streak-cell{aspect-ratio:1;border-radius:4px;background:rgba(148,163,184,0.16);display:block}
        .streak-cell.intensity-1{background:rgba(99,102,241,0.38)}.streak-cell.intensity-2{background:rgba(99,102,241,0.68)}.streak-cell.intensity-3{background:#6366f1}
        .heat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
        .heat-cell{border:1px solid var(--border);border-top:4px solid var(--muted);border-radius:10px;padding:10px;background:var(--sidebar);display:grid;gap:2px}
        .heat-cell span{color:var(--muted-foreground);font-size:12px}
      `}</style>
    </div>
  );
}
