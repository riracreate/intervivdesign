import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { decodeReportCard } from "@/lib/interviv/share";
import { Heading, SkillBar, ArrowRight } from "./ui";

/** Public card: renders only what the share link carries. No account needed. */
export function ReportCard({ code }: { code: string | undefined }) {
  const card = decodeReportCard(code);
  if (!card) {
    return (
      <>
        <Heading
          eyebrow="InterViv report card"
          title="This card link is incomplete."
          subtitle="Ask the owner for a fresh share link, or start your own practice."
        />
        <Button asChild>
          <Link to="/practice">
            Start practicing <ArrowRight />
          </Link>
        </Button>
      </>
    );
  }
  return (
    <>
      <Heading
        eyebrow="InterViv · Public report card"
        title={card.title}
        subtitle={`Shared practice summary · ${card.date} · The owner chose to share this link.`}
        action={
          <Button variant="outline" className="no-print" onClick={() => window.print()}>
            Print / save PDF
          </Button>
        }
      />
      <section className="panel stack report-card">
        <div className="metrics">
          <div className="metric">
            <div className="metric-label">Unassisted score</div>
            <div className="metric-value">
              {card.score ?? "—"}
              {card.score != null ? <small>/100</small> : null}
            </div>
            <p className="metric-note">Deterministic concept estimate</p>
          </div>
          <div className="metric">
            <div className="metric-label">Rounds</div>
            <div className="metric-value">{card.rounds}</div>
            <p className="metric-note">Questions practiced</p>
          </div>
          <div className="metric">
            <div className="metric-label">Level</div>
            <div className="metric-value">
              {card.level}
              <small> · {card.xp} XP</small>
            </div>
            <p className="metric-note">Across skill tracks</p>
          </div>
        </div>
        <div>
          <h3>Strongest area: {card.topSkill}</h3>
          <p className="small text-muted">Skills practiced: {card.skills.join(" · ") || "—"}</p>
        </div>
        {card.score != null && (
          <SkillBar label="Readiness estimate" value={card.score} note={`${card.score}%`} />
        )}
        <p className="tiny text-muted">
          InterViv scores are disclosed rule-based concept estimates (keyword coverage + structure),
          not verified hiring evaluations. This public card shows only the summary the owner shared
          — full transcripts stay private.
        </p>
        <div className="row no-print">
          <Button asChild>
            <Link to="/practice">
              Practice with InterViv <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
      <style>{`@media print{.no-print{display:none!important}}`}</style>
    </>
  );
}
