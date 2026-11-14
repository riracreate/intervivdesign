import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useWorkspace, type SessionRecord, type Round } from "@/lib/interviv/workspace";
import { evaluate, type Question, problems } from "@/lib/interviv/data";
import { Heading, ArrowRight, Check, Volume2, Plus } from "./ui";
import { toast } from "sonner";
export function Session({ id }: { id: string }) {
  const { sessions, saveSession, user } = useWorkspace();
  const session = sessions.find((s) => s.id === id);
  if (!user) return <div className="empty">Sign in to continue your practice.</div>;
  if (!session) return <div className="empty">Loading your session…</div>;
  return <Player key={id} session={session} saveSession={saveSession} />;
}
function Player({
  session,
  saveSession,
}: {
  session: SessionRecord;
  saveSession: (s: SessionRecord) => Promise<void>;
}) {
  const nav = useNavigate();
  const qs = session.draft["questions"] as unknown as Question[];
  const [index, setIndex] = useState(Number(session.draft["index"] ?? session.rounds.length));
  const [answer, setAnswer] = useState(String(session.draft["answer"] ?? ""));
  const [selected, setSelected] = useState<number | null>(null);
  const [review, setReview] = useState<Round | null>(null);
  const [hint, setHint] = useState(false);
  const [assisted, setAssisted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sqlOutput, setSqlOutput] = useState<Record<string, unknown>[]>([]);
  const [nodes, setNodes] = useState<string[]>([]);
  const assessment = Boolean(session.draft["assessment"]);
  const deadline = Number(session.draft["deadline"] ?? 0);
  const [remaining, setRemaining] = useState(
    deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0,
  );
  const q = qs?.[index];
  const coding = session.mode === "coding" || session.mode === "ml";
  const sql = session.mode === "sql" || (session.mode === "combined" && index % 2 === 1);
  const design = session.mode === "design";
  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(
      () => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))),
      1000,
    );
    return () => clearInterval(timer);
  }, [deadline]);
  useEffect(() => {
    if (!q || review) return;
    const timer = setTimeout(() => {
      saveSession({ ...session, draft: { ...session.draft, answer, index } }).catch(() =>
        toast.error("Draft could not be saved."),
      );
    }, 900);
    return () => clearTimeout(timer);
  }, [answer, index]);
  async function submit() {
    if (!q || busy || review) return;
    if (!answer.trim() && selected === null && !assessment) {
      toast.error("Add your answer first.");
      return;
    }
    setBusy(true);
    try {
      const result = evaluate(q, answer, selected);
      if (sql) {
        result.score = 0;
        result.feedback =
          "SQL query saved. Query results can be explored, but automated SQL grading is not connected. This round is unscored.";
      }
      if (coding) {
        result.score = 0;
        result.feedback =
          "Code saved without execution. This round is unscored and excluded from readiness.";
      }
      const round: Round = {
        question: q,
        answer,
        selected,
        result,
        assisted: assisted || coding || sql,
      };
      setReview(round);
      await saveSession({
        ...session,
        rounds: [...session.rounds, round],
        assisted: session.assisted || round.assisted,
        draft: { ...session.draft, index, answer },
      });
    } catch {
      toast.error("Your answer could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (deadline && remaining === 0 && !review && q) submit();
  }, [remaining]);
  async function next() {
    if (!review) return;
    const completed = index + 1 >= qs.length;
    const rounds = session.rounds;
    const measured = rounds.filter((r) => !r.assisted);
    const score = measured.length
      ? Math.round(measured.reduce((a, r) => a + r.result.score, 0) / measured.length)
      : null;
    try {
      await saveSession({
        ...session,
        status: completed ? "complete" : "in_progress",
        score: completed ? score : null,
        draft: { ...session.draft, index: index + 1, answer: "" },
      });
      if (completed) {
        await nav({ to: "/dashboard/$sessionId", params: { sessionId: session.id } });
      } else {
        setIndex(index + 1);
        setAnswer("");
        setSelected(null);
        setHint(false);
        setAssisted(false);
        setReview(null);
      }
    } catch {
      toast.error("Could not advance your session.");
    }
  }
  async function runSQL() {
    try {
      const { default: alasql } = await import("alasql");
      const result = alasql(answer, [
        [
          { name: "Ada", department: "Engineering", salary: 90000 },
          { name: "Lin", department: "Engineering", salary: 75000 },
          { name: "Sam", department: "Design", salary: 80000 },
        ],
      ]);
      setSqlOutput(Array.isArray(result) ? result : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Query failed.");
    }
  }
  if (!q)
    return (
      <div className="empty">
        This session is complete.
        <Button
          onClick={() => nav({ to: "/dashboard/$sessionId", params: { sessionId: session.id } })}
        >
          View report
        </Button>
      </div>
    );
  return (
    <div className="session-layout">
      <Heading
        eyebrow={`${q.skill} · ${assessment ? "Assessment" : "Coached practice"}`}
        title={session.title}
        action={
          <div className="row">
            <span className="pill">
              Round {index + 1} / {qs.length}
            </span>
            {deadline > 0 && (
              <span className={`pill ${remaining <= 15 ? "warning" : ""}`}>
                {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
              </span>
            )}
            <Button
              variant="outline"
              onClick={async () => {
                await saveSession({ ...session, draft: { ...session.draft, index, answer } });
                await nav({ to: "/" });
              }}
            >
              Save & exit
            </Button>
          </div>
        }
      />
      <progress className="full" max={qs.length} value={index} />
      <section className="panel">
        <div className="row between">
          <span className="pill">{q.skill}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Read question aloud"
            title="Read question aloud"
            onClick={() => {
              speechSynthesis.cancel();
              speechSynthesis.speak(new SpeechSynthesisUtterance(q.prompt));
            }}
          >
            <Volume2 />
          </Button>
        </div>
        <h2 className="session-question">
          {sql
            ? "Find employees earning more than 80,000. Return their name and salary."
            : coding
              ? (problems[0]?.statement ?? "Write your solution")
              : q.prompt}
        </h2>
        {sql && (
          <>
            <pre className="code-block">
              employees: name TEXT, department TEXT, salary INTEGER
              <br />
              Ada | Engineering | 90000
              <br />
              Lin | Engineering | 75000
              <br />
              Sam | Design | 80000
            </pre>
            <p className="small text-muted">Query the sample table with SELECT … FROM ?</p>
          </>
        )}
        {coding && (
          <>
            <p className="notice warning">
              Code execution is unavailable. Your solution is saved, not scored.
            </p>
            <pre className="code-block">{problems[0]?.example}</pre>
            <select aria-label="Code language">
              <option>JavaScript</option>
              <option>Python</option>
              <option>Java</option>
              <option>C++</option>
            </select>
          </>
        )}
        {q.options && !sql ? (
          <div className="stack">
            {q.options.map((o, i) => (
              <Button
                variant="ghost"
                key={o}
                disabled={Boolean(review)}
                className={`option ${selected === i ? "selected" : ""} ${review && i === q.correct ? "correct" : ""}`}
                onClick={() => setSelected(i)}
              >
                <span className="step-number">{String.fromCharCode(65 + i)}</span>
                {o}
              </Button>
            ))}
          </div>
        ) : (
          <>
            <label>
              Your {sql ? "query" : coding ? "solution" : "answer"}
              <textarea
                className={sql || coding ? "code-editor" : ""}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={Boolean(review)}
                placeholder={
                  sql
                    ? "SELECT name, salary FROM ? WHERE salary > 80000"
                    : coding
                      ? (problems[0]?.code ?? "")
                      : "Take a breath. Think it through. Make it your own."
                }
              />
            </label>
            <div className="row between tiny text-muted">
              <span>{answer.trim().split(/\s+/).filter(Boolean).length} words</span>
              <span>{answer ? "Draft saving…" : "Ready when you are"}</span>
            </div>
          </>
        )}
        {session.mode === "behavioral" && !review && (
          <div className="grid-two mt-5">
            {["Situation", "Task", "Action", "Result"].map((s) => (
              <label key={s}>
                {s}
                <textarea
                  placeholder={`${s}…`}
                  onBlur={(e) => {
                    if (e.target.value) setAnswer((a) => `${a}\n${s}: ${e.target.value}`);
                  }}
                />
              </label>
            ))}
          </div>
        )}
        {design && (
          <div className="stack mt-5">
            <h3>Your architecture</h3>
            <div className="chip-group">
              {[
                "Load balancer",
                "API gateway",
                "Database",
                "Redis cache",
                "Message queue",
                "CDN",
                "Read replica",
              ].map((n) => (
                <Button variant="outline" size="sm" key={n} onClick={() => setNodes([...nodes, n])}>
                  <Plus />
                  {n}
                </Button>
              ))}
            </div>
            <div className="whiteboard">
              {nodes.map((n, i) => (
                <div
                  key={`${n}-${i}`}
                  draggable
                  className="whiteboard-node"
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = Number(e.dataTransfer.getData("text/plain"));
                    const next = [...nodes];
                    const a = next[i];
                    const b = next[from];
                    if (!a || !b) return;
                    next[i] = b;
                    next[from] = a;
                    setNodes(next);
                  }}
                >
                  {n}
                  <ArrowRight size={14} />
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Remove node"
                    onClick={() => setNodes(nodes.filter((_, j) => j !== i))}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        {sql && (
          <>
            <Button variant="outline" className="mt-4" onClick={runSQL}>
              Run query
            </Button>
            {sqlOutput.length > 0 && (
              <pre className="code-block mt-4">{JSON.stringify(sqlOutput, null, 2)}</pre>
            )}
          </>
        )}
        {hint && <p className="notice mt-5">{q.hint}</p>}
        <div className="session-actions">
          <Button
            variant="outline"
            disabled={assessment || Boolean(review) || hint}
            onClick={() => {
              setHint(true);
              setAssisted(true);
            }}
          >
            {assessment ? "Hints locked" : "A little hint"}
          </Button>
          <Button disabled={busy || Boolean(review)} onClick={submit}>
            {busy ? "Saving…" : coding ? "Save unscored answer" : "Submit answer"}
            <Check />
          </Button>
        </div>
      </section>
      {review && (
        <section className="feedback">
          <div className="row between">
            <h3>
              {coding
                ? "Solution saved"
                : `${review.result.score}/100 · Your answer, a little clearer.`}
            </h3>
            <span className="pill">{review.assisted ? "Practiced with help" : "Unassisted"}</span>
          </div>
          <p>{review.result.feedback}</p>
          {!coding && (
            <>
              <div className="grid-two mt-4">
                {(["correctness", "coverage", "depth", "clarity"] as const).map((k) => (
                  <div className="skill-line" key={k}>
                    <div className="row between">
                      <span>{k}</span>
                      <span>{review.result[k]}/10</span>
                    </div>
                    <progress max={10} value={review.result[k]} />
                  </div>
                ))}
              </div>
              <p className="tiny text-muted">
                Rule-based concept coverage estimate, not a verified hiring evaluation.
              </p>
            </>
          )}
          <Button className="mt-5" onClick={next}>
            {index + 1 === qs.length ? "Finish & see my report" : "Next question"}
            <ArrowRight />
          </Button>
        </section>
      )}
    </div>
  );
}
