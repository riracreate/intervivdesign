import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/interviv/workspace";
import { supabase } from "@/integrations/supabase/client";
import {
  dueTopics,
  ensureStates,
  initialState,
  qualityFromScore,
  sm2Update,
  type SpacedState,
} from "@/lib/interviv/spaced-repetition";
import {
  difficultyForAccuracy,
  lastSeenFromSessions,
  parseResumeAndJD,
  selectAdaptive,
  topicAccuracy,
} from "@/lib/interviv/adaptive";
import { Heading, SkillBar, ArrowRight, AuthPrompt } from "./ui";
import { toast } from "sonner";

export function spacedList(data: { spaced?: Record<string, SpacedState> }): SpacedState[] {
  return Object.values(data.spaced ?? {});
}

export function AdaptiveHub() {
  const { user, data, sessions, update, saveSession } = useWorkspace();
  const nav = useNavigate();
  const [resume, setResume] = useState(data.resume ?? "");
  const [jd, setJd] = useState("");
  const [role, setRole] = useState(data.role ?? "Software Engineer");
  const [plan, setPlan] = useState<ReturnType<typeof parseResumeAndJD> | null>(null);
  const [busy, setBusy] = useState(false);

  const accuracy = useMemo(() => topicAccuracy(sessions), [sessions]);
  const practicedTopics = useMemo(() => [...accuracy.keys()], [accuracy]);
  const states = useMemo(
    () => ensureStates(practicedTopics, spacedList(data)),
    [practicedTopics, data],
  );
  const due = useMemo(() => dueTopics(states), [states]);
  const lastSeen = useMemo(() => lastSeenFromSessions(sessions), [sessions]);

  async function persistStates(next: SpacedState[]) {
    const record: Record<string, SpacedState> = {};
    for (const s of next) record[s.topic] = s;
    await update({ spaced: record });
    if (user) {
      for (const s of next) {
        await supabase
          .from("spaced_repetition" as never)
          .upsert(
            {
              user_id: user.id,
              topic: s.topic,
              next_due: s.nextDue,
              interval_days: s.intervalDays,
              ease_factor: s.easeFactor,
              repetitions: s.repetitions,
              last_quality: s.lastQuality,
              last_reviewed_at: s.lastReviewedAt,
              updated_at: new Date().toISOString(),
            } as never,
            { onConflict: "user_id,topic" } as never,
          )
          .then(({ error }) => {
            if (error)
              console.info("[adaptive] spaced_repetition not yet migrated:", error.message);
          });
      }
    }
  }

  async function grade(topic: string, quality: number) {
    const current = states.find((s) => s.topic === topic) ?? initialState(topic);
    const nextState = sm2Update(current, quality);
    await persistStates(
      states
        .map((s) => (s.topic === topic ? nextState : s))
        .concat(states.some((s) => s.topic === topic) ? [] : [nextState]),
    );
    toast.success(
      `${topic} next due in ${nextState.intervalDays} day(s) · ease ${nextState.easeFactor}`,
    );
  }

  async function gradeFromLatestScore(topic: string) {
    const acc = accuracy.get(topic);
    if (acc == null) return;
    await grade(topic, qualityFromScore(acc));
  }

  function generate() {
    if (resume.trim().length < 20 || jd.trim().length < 20) {
      toast.error("Paste a fuller resume and job description (20+ characters each).");
      return;
    }
    setPlan(parseResumeAndJD(resume, jd, 5));
  }

  async function startSet() {
    if (!plan || !plan.questionSet.length) return;
    if (!user) {
      toast.info("Sign in to start and save this set.");
      return;
    }
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      await saveSession({
        id,
        title: `${role} — role-specific set`,
        mode: "interview",
        skills: [...new Set(plan.questionSet.map((q) => q.skill))],
        rounds: [],
        status: "in_progress",
        score: null,
        assisted: false,
        created_at: new Date().toISOString(),
        draft: { questions: plan.questionSet, answer: "", index: 0, assessment: false },
      });
      await nav({ to: "/session/$sessionId", params: { sessionId: id } });
    } catch {
      toast.error("Could not start this set.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Heading
        eyebrow="Adaptive learning"
        title="Review what matters, when it matters."
        subtitle="SM-2 spaced repetition per topic, difficulty that follows your accuracy, and question sets built from your resume and a real job description."
      />
      {!user && <AuthPrompt />}

      <div className="grid-two-adaptive">
        <section className="panel stack" aria-labelledby="due-title">
          <h2 id="due-title">Due today ({due.length})</h2>
          {due.length === 0 && (
            <p className="small text-muted">
              Nothing due. Practice a topic, then grade your recall here — SM-2 schedules the next
              review (1d → 6d → × ease).
            </p>
          )}
          {due.map((s) => (
            <div key={s.topic} className="due-row">
              <div>
                <b>{s.topic}</b>
                <small>
                  Due{" "}
                  {new Date(s.nextDue).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  · interval {s.intervalDays}d · ease {s.easeFactor} · reps {s.repetitions}
                </small>
              </div>
              <div className="row">
                <Button size="sm" variant="outline" onClick={() => grade(s.topic, 2)}>
                  Again
                </Button>
                <Button size="sm" variant="outline" onClick={() => grade(s.topic, 3)}>
                  Hard
                </Button>
                <Button size="sm" variant="outline" onClick={() => grade(s.topic, 4)}>
                  Good
                </Button>
                <Button size="sm" onClick={() => grade(s.topic, 5)}>
                  Easy
                </Button>
              </div>
            </div>
          ))}
          <p className="tiny text-muted">
            Grades follow SM-2: below 3 relearns tomorrow; ease adapts (min 1.3). “Grade from score”
            maps your latest deterministic accuracy to a grade.
          </p>
        </section>

        <section className="panel stack" aria-labelledby="difficulty-title">
          <h2 id="difficulty-title">Adaptive difficulty by topic</h2>
          {practicedTopics.length === 0 && (
            <p className="small text-muted">
              Finish an unassisted round and your per-topic accuracy will steer difficulty: under
              60% easier, over 85% harder, 7-day no-repeat.
            </p>
          )}
          {practicedTopics.map((topic) => {
            const acc = accuracy.get(topic) ?? 0;
            const band = difficultyForAccuracy(acc);
            const next = selectAdaptive({
              skill: topic,
              accuracyPct: acc,
              lastSeenById: lastSeen,
              nowMs: Date.now(),
              count: 1,
            })[0];
            return (
              <div key={topic} className="stack">
                <SkillBar label={topic} value={acc} note={`${acc}% · ${band}`} />
                <p className="tiny text-muted">
                  Next up:{" "}
                  {next ? `“${next.prompt.slice(0, 90)}…”` : "bank exhausted for this topic"}{" "}
                  <Button
                    variant="link"
                    className="text-link p-0"
                    onClick={() => gradeFromLatestScore(topic)}
                  >
                    Grade from score
                  </Button>
                </p>
              </div>
            );
          })}
        </section>
      </div>

      <section className="panel stack" aria-labelledby="parser-title">
        <h2 id="parser-title">Resume + job description → role-specific set</h2>
        <p className="small text-muted">
          Deterministic skill matching (same disclosed approach as scoring — explicit mentions only,
          no ML inference). Gap skills are questioned first.
        </p>
        <label>
          Target role
          <input value={role} onChange={(e) => setRole(e.target.value)} aria-label="Target role" />
        </label>
        <div className="grid-two-adaptive">
          <label>
            Your resume (paste text)
            <textarea
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              rows={7}
              placeholder="Paste resume text — skills you already show…"
            />
          </label>
          <label>
            Job description (paste text)
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              rows={7}
              placeholder="Paste the job description — skills the role asks for…"
            />
          </label>
        </div>
        <div className="row">
          <Button onClick={generate}>Generate question set</Button>
          {plan && (
            <span className="pill">
              {plan.questionSet.length} questions · {plan.gaps.length} gaps first
            </span>
          )}
        </div>
        {plan && (
          <div className="stack">
            <p className="small">
              <b>On your resume:</b> {plan.resumeSkills.join(", ") || "—"} · <b>Role asks:</b>{" "}
              {plan.jdSkills.join(", ") || "—"}
            </p>
            <p className="small">
              <b>Matched:</b> {plan.matched.join(", ") || "—"} · <b>Gaps to close:</b>{" "}
              {plan.gaps.join(", ") || "none — depth check"}
            </p>
            <ol className="question-set">
              {plan.questionSet.map((q) => (
                <li key={q.id}>
                  <b>{q.skill}:</b> {q.prompt}
                </li>
              ))}
            </ol>
            {plan.questionSet.length === 0 && (
              <p className="notice">
                No bank questions match those skills yet. Try DSA, DBMS, OOP, Python, System design,
                or Behavioral wording.
              </p>
            )}
            <Button onClick={startSet} disabled={busy || !plan.questionSet.length}>
              {busy ? "Starting…" : "Start this set"} <ArrowRight />
            </Button>
          </div>
        )}
      </section>

      <style>{`
        .grid-two-adaptive{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
        @media(max-width:900px){.grid-two-adaptive{grid-template-columns:1fr}}
        .due-row{display:flex;justify-content:space-between;gap:12px;align-items:center;border-top:1px solid var(--border);padding-top:10px;flex-wrap:wrap}
        .due-row small{display:block;color:var(--muted-foreground)}
        .question-set{display:grid;gap:6px;padding-left:20px}
      `}</style>
      <p className="tiny text-muted mt-4">
        Schedule persists to <code>spaced_repetition</code> (Drizzle table in db-tables.ts) and your
        workspace.{" "}
        <Link to="/learn" className="text-link">
          Open the learning hub
        </Link>
      </p>
    </>
  );
}
