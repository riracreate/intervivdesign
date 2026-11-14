import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  useWorkspace,
  type SessionRecord,
  type Round,
  type WorkspaceData,
} from "@/lib/interviv/workspace";
import { evaluate, type Question } from "@/lib/interviv/data";
import {
  codingChallenges,
  gradeSqlRows,
  runJavaScriptChallenge,
  sqlChallenges,
  type CodeExecutionResult,
} from "@/lib/interviv/code-runner";
import { scheduleReviewItem } from "@/lib/interviv/spaced-repetition";
import { Heading, ArrowRight, Check, Volume2, Plus, Play, Mic } from "./ui";
import { toast } from "sonner";

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function Session({ id }: { id: string }) {
  const { sessions, saveSession, user, ready, sessionsReady, data, update } = useWorkspace();
  if (!ready) return <div className="empty">Loading your workspace…</div>;
  if (!user) return <div className="empty">Sign in to continue your practice.</div>;
  if (!sessionsReady) return <div className="empty">Loading your session…</div>;
  const session = sessions.find((s) => s.id === id);
  if (!session) {
    return (
      <div className="empty stack">
        <p>We couldn’t find this practice session.</p>
        <Button asChild>
          <Link to="/practice">
            Start a new session <ArrowRight />
          </Link>
        </Button>
      </div>
    );
  }
  if (session.status === "complete") {
    return (
      <div className="empty stack">
        <p>
          {session.draft["timeExpired"]
            ? "Time expired and this assessment was finalized."
            : "This session is complete."}
        </p>
        <Button asChild>
          <Link to="/dashboard/$sessionId" params={{ sessionId: session.id }}>
            View report <ArrowRight />
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <Player
      key={id}
      session={session}
      saveSession={saveSession}
      workspaceData={data}
      updateWorkspace={update}
    />
  );
}

function computeFinalScore(rounds: Round[]) {
  const measured = rounds.filter((r) => !r.assisted);
  return measured.length
    ? Math.round(measured.reduce((a, r) => a + r.result.score, 0) / measured.length)
    : null;
}

function Player({
  session,
  saveSession,
  workspaceData,
  updateWorkspace,
}: {
  session: SessionRecord;
  saveSession: (s: SessionRecord) => Promise<void>;
  workspaceData: WorkspaceData;
  updateWorkspace: (value: Partial<WorkspaceData>) => Promise<void>;
}) {
  const nav = useNavigate();
  const qs = session.draft["questions"] as unknown as Question[];
  const initialIndex = Number(session.draft["index"] ?? session.rounds.length);
  const existingRound = session.rounds[initialIndex] ?? null;
  const [index, setIndex] = useState(initialIndex);
  const [answer, setAnswer] = useState(String(session.draft["answer"] ?? ""));
  const [selected, setSelected] = useState<number | null>(
    typeof session.draft["selected"] === "number" ? session.draft["selected"] : null,
  );
  const [star, setStar] = useState<Record<string, string>>({
    Situation: "",
    Task: "",
    Action: "",
    Result: "",
  });
  const [review, setReview] = useState<Round | null>(existingRound);
  const [hint, setHint] = useState(false);
  const [assisted, setAssisted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sqlOutput, setSqlOutput] = useState<Record<string, unknown>[]>([]);
  const [sqlVerdict, setSqlVerdict] = useState<{ passed: boolean; feedback: string } | null>(null);
  const [codeExec, setCodeExec] = useState<CodeExecutionResult | null>(null);
  const [nodes, setNodes] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);

  const assessment = Boolean(session.draft["assessment"]);
  const deadline = Number(session.draft["deadline"] ?? 0);
  const [remaining, setRemaining] = useState(() =>
    deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0,
  );
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const expiredHandledRef = useRef(false);

  const q = qs?.[index];
  const coding = session.mode === "coding" || session.mode === "ml";
  const sql = session.mode === "sql" || (session.mode === "combined" && index % 2 === 1);
  const design = session.mode === "design";
  const activeCodingChallenge = codingChallenges[index % codingChallenges.length];
  const activeSqlChallenge = sqlChallenges[index % sqlChallenges.length];

  useEffect(() => {
    setCodeExec(null);
    setSqlVerdict(null);
    setSqlOutput([]);
  }, [index]);

  const evaluateRound = useCallback(
    (question: Question, currentAnswer: string, currentSelected: number | null): Round => {
      if (sql && activeSqlChallenge) {
        if (sqlVerdict) {
          const score = sqlVerdict.passed ? 100 : 35;
          return {
            question,
            answer: currentAnswer,
            selected: currentSelected,
            result: {
              score,
              coverage: sqlVerdict.passed ? 10 : 4,
              correctness: sqlVerdict.passed ? 10 : 3,
              clarity: 8,
              depth: 8,
              missing: sqlVerdict.passed ? [] : ["expected row set"],
              feedback: sqlVerdict.feedback,
            },
            assisted,
          };
        }
        const base = evaluate(question, currentAnswer, currentSelected);
        base.score = 0;
        base.feedback =
          "SQL query saved without execution. Run & grade SQL to score this round deterministically.";
        return {
          question,
          answer: currentAnswer,
          selected: currentSelected,
          result: base,
          assisted: true,
        };
      }
      if (coding && activeCodingChallenge) {
        const exec = codeExec;
        if (exec && !exec.compileError) {
          const score = Math.round((exec.passedCount / Math.max(exec.totalCount, 1)) * 100);
          const pts = Math.round((score / 100) * 10);
          return {
            question: { ...question, prompt: activeCodingChallenge.statement },
            answer: currentAnswer,
            selected: currentSelected,
            result: {
              score,
              coverage: pts,
              correctness: pts,
              clarity: currentAnswer.length > 60 ? 8 : 5,
              depth: pts,
              missing: exec.ok ? [] : ["passing all test cases"],
              feedback: `Executed ${exec.passedCount}/${exec.totalCount} visible JavaScript test cases.`,
            },
            assisted,
          };
        }
        const base = evaluate(question, currentAnswer, currentSelected);
        base.score = 0;
        base.feedback =
          "Code saved without passing a test run. Run tests before submitting to score this round.";
        return {
          question: { ...question, prompt: activeCodingChallenge.statement },
          answer: currentAnswer,
          selected: currentSelected,
          result: base,
          assisted: true,
        };
      }
      const result = evaluate(question, currentAnswer, currentSelected);
      return {
        question,
        answer: currentAnswer,
        selected: currentSelected,
        result,
        assisted,
      };
    },
    [activeCodingChallenge, activeSqlChallenge, assisted, codeExec, coding, sql, sqlVerdict],
  );

  const finalizeExpiredAssessment = useCallback(async () => {
    if (expiredHandledRef.current || !assessment || !deadline) return;
    expiredHandledRef.current = true;
    const latest = sessionRef.current;
    let nextRounds = latest.rounds;
    if (q && !review && !nextRounds.some((r) => r.question.id === q.id)) {
      const round = evaluateRound(q, answer, selected);
      nextRounds = [...nextRounds, round];
    }
    const finalScore = computeFinalScore(nextRounds);
    try {
      await saveSession({
        ...latest,
        rounds: nextRounds,
        assisted: latest.assisted || nextRounds.some((r) => r.assisted),
        status: "complete",
        score: finalScore,
        draft: {
          ...latest.draft,
          index: nextRounds.length,
          answer: "",
          selected: null,
          timeExpired: true,
        },
      });
      toast.info("Time’s up — your assessment has been finalized.");
      await nav({ to: "/dashboard/$sessionId", params: { sessionId: latest.id } });
    } catch {
      expiredHandledRef.current = false;
      toast.error("Could not finalize your timed assessment.");
    }
  }, [answer, assessment, deadline, evaluateRound, nav, q, review, saveSession, selected]);

  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const nextRemaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(nextRemaining);
      if (nextRemaining === 0) {
        void finalizeExpiredAssessment();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadline, finalizeExpiredAssessment]);

  useEffect(() => {
    if (!q || review || expiredHandledRef.current) return;
    const timer = setTimeout(() => {
      const latest = sessionRef.current;
      saveSession({
        ...latest,
        draft: { ...latest.draft, answer, selected, index },
      }).catch(() => toast.error("Draft could not be saved."));
    }, 900);
    return () => clearTimeout(timer);
  }, [answer, selected, index, q, review, saveSession]);

  function toggleVoiceDictation() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Rec = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!Rec) {
      toast.info("Voice dictation is unavailable in this browser. Type your answer below.");
      return;
    }
    const recognition = new Rec();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const text = last?.[0]?.transcript?.trim();
      if (text) {
        setAnswer((prev) => (prev ? `${prev} ${text}` : text));
      }
    };
    recognition.onerror = () => {
      setListening(false);
      toast.error("Microphone capture stopped. Check permissions or type your response.");
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    toast.success("Listening — speak clearly, then click Stop voice.");
  }

  function runCodingRound() {
    if (!activeCodingChallenge) return;
    const source = answer.trim() ? answer : activeCodingChallenge.code;
    if (!answer.trim()) setAnswer(activeCodingChallenge.code);
    const exec = runJavaScriptChallenge(activeCodingChallenge, source);
    setCodeExec(exec);
    if (exec.ok) toast.success(`All ${exec.totalCount} tests passed.`);
    else if (exec.compileError) toast.error(exec.compileError);
    else toast.info(`${exec.passedCount}/${exec.totalCount} tests passed.`);
  }

  async function runSQL() {
    if (!activeSqlChallenge) return;
    const query = answer.trim() ? answer : activeSqlChallenge.starterSql;
    if (!answer.trim()) setAnswer(activeSqlChallenge.starterSql);
    try {
      const { default: alasql } = await import("alasql");
      const result = alasql(query, [activeSqlChallenge.rows]);
      const rows = Array.isArray(result) ? (result as Record<string, unknown>[]) : [];
      setSqlOutput(rows);
      const verdict = gradeSqlRows(
        rows,
        activeSqlChallenge.expectedRows,
        activeSqlChallenge.orderSensitive,
      );
      setSqlVerdict(verdict);
      if (verdict.passed) toast.success("SQL output matched expected rows.");
      else toast.info(verdict.feedback);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Query failed.");
    }
  }

  async function submit() {
    if (!q || busy || review) return;
    if (assessment && deadline > 0 && Date.now() >= deadline) {
      await finalizeExpiredAssessment();
      return;
    }
    if (!answer.trim() && selected === null && !assessment) {
      toast.error("Add your answer first.");
      return;
    }
    setBusy(true);
    try {
      const latest = sessionRef.current;
      const round = evaluateRound(q, answer, selected);
      const nextRounds = latest.rounds.some((r) => r.question.id === round.question.id)
        ? latest.rounds.map((r) => (r.question.id === round.question.id ? round : r))
        : [...latest.rounds, round];
      setReview(round);
      await saveSession({
        ...latest,
        rounds: nextRounds,
        assisted: latest.assisted || round.assisted,
        draft: { ...latest.draft, index, answer, selected },
      });

      // Schedule spaced repetition entry for non-coding/SQL question reviews
      if (!coding && !sql) {
        const existingSchedule = workspaceData.reviewSchedule ?? [];
        const existingItem = existingSchedule.find(
          (item) => item.questionId === q.id.replace(/-\d+$/, ""),
        );
        const updatedItem = scheduleReviewItem(existingItem, q, round.result.score);
        await updateWorkspace({
          reviewSchedule: [
            ...existingSchedule.filter((x) => x.questionId !== updatedItem.questionId),
            updatedItem,
          ],
        });
      }
    } catch {
      toast.error("Your answer could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (!review) return;
    if (assessment && deadline > 0 && Date.now() >= deadline) {
      await finalizeExpiredAssessment();
      return;
    }
    const latest = sessionRef.current;
    const nextRounds = latest.rounds.some((r) => r.question.id === review.question.id)
      ? latest.rounds
      : [...latest.rounds, review];
    const completed = index + 1 >= qs.length;
    const score = computeFinalScore(nextRounds);
    try {
      await saveSession({
        ...latest,
        rounds: nextRounds,
        assisted: latest.assisted || review.assisted,
        status: completed ? "complete" : "in_progress",
        score: completed ? score : null,
        draft: { ...latest.draft, index: index + 1, answer: "", selected: null },
      });
      if (completed) {
        await nav({ to: "/dashboard/$sessionId", params: { sessionId: latest.id } });
      } else {
        setIndex(index + 1);
        setAnswer("");
        setSelected(null);
        setStar({ Situation: "", Task: "", Action: "", Result: "" });
        setHint(false);
        setAssisted(false);
        setReview(null);
        setNodes([]);
      }
    } catch {
      toast.error("Could not advance your session.");
    }
  }

  if (!q)
    return (
      <div className="empty">
        This session is complete.{" "}
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
        eyebrow={`${q.skill} · ${assessment ? "Timed Assessment" : "Coached Practice"}`}
        title={session.title}
        action={
          <div className="row wrap">
            <span className="meta-line">
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
                const latest = sessionRef.current;
                await saveSession({
                  ...latest,
                  draft: { ...latest.draft, index, answer, selected },
                });
                await nav({ to: "/" });
              }}
            >
              Save & exit
            </Button>
          </div>
        }
      />
      <progress className="full mb-4" max={qs.length} value={index} />
      <section className="panel stack">
        <div className="row between wrap">
          <span className="pill">{q.skill}</span>
          <div className="row">
            {!coding && !sql && !q.options && !review && (
              <Button
                variant={listening ? "secondary" : "outline"}
                size="sm"
                onClick={toggleVoiceDictation}
              >
                <Mic size={15} /> {listening ? "Stop voice" : "Voice answer"}
              </Button>
            )}
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
        </div>

        <h2 className="session-question" style={{ margin: "6px 0" }}>
          {sql && activeSqlChallenge
            ? activeSqlChallenge.prompt
            : coding && activeCodingChallenge
              ? activeCodingChallenge.statement
              : q.prompt}
        </h2>

        {sql && activeSqlChallenge && (
          <>
            <pre className="code-block">
              {activeSqlChallenge.schema}
              {"\n"}
              {JSON.stringify(activeSqlChallenge.rows, null, 2)}
            </pre>
            <p className="meta-line">
              Query the active dataset using <code>FROM ?</code>
            </p>
          </>
        )}

        {coding && activeCodingChallenge && (
          <>
            <pre className="code-block">{activeCodingChallenge.example}</pre>
            <div className="row between wrap">
              <span className="meta-line">
                JavaScript runner ({activeCodingChallenge.fnName}) ·{" "}
                {activeCodingChallenge.tests.length} visible tests
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAnswer(activeCodingChallenge.code)}
                disabled={Boolean(review)}
              >
                Load starter code
              </Button>
            </div>
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
              Your {sql ? "SQL query" : coding ? "JavaScript solution" : "answer"}
              <textarea
                className={sql || coding ? "code-editor" : ""}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={Boolean(review)}
                placeholder={
                  sql
                    ? (activeSqlChallenge?.starterSql ?? "SELECT * FROM ?")
                    : coding
                      ? (activeCodingChallenge?.code ?? "")
                      : "Explain your approach, core trade-offs, and one concrete example…"
                }
              />
            </label>
            <div className="row between meta-line">
              <span>{answer.trim().split(/\s+/).filter(Boolean).length} words</span>
              <span>{answer ? "Draft auto-saving" : "Ready"}</span>
            </div>
          </>
        )}

        {session.mode === "behavioral" && !review && (
          <div className="grid-two">
            {(["Situation", "Task", "Action", "Result"] as const).map((s) => (
              <label key={s}>
                {s}
                <textarea
                  style={{ minHeight: 90 }}
                  value={star[s] ?? ""}
                  placeholder={`${s}…`}
                  onChange={(e) => {
                    const nextStar = { ...star, [s]: e.target.value };
                    setStar(nextStar);
                    const composed = (["Situation", "Task", "Action", "Result"] as const)
                      .map((part) => (nextStar[part] ? `${part}: ${nextStar[part]}` : ""))
                      .filter(Boolean)
                      .join("\n");
                    setAnswer(composed);
                  }}
                />
              </label>
            ))}
          </div>
        )}

        {design && (
          <div className="stack">
            <div className="row between wrap">
              <h3>Interactive Architecture Whiteboard</h3>
              <span className="meta-line">{nodes.length} connected component(s)</span>
            </div>
            <div className="chip-group">
              {[
                "CDN",
                "Load balancer",
                "API gateway",
                "Redis cache",
                "Database",
                "Read replica",
                "Message queue",
              ].map((n) => (
                <Button
                  variant="outline"
                  size="sm"
                  key={n}
                  onClick={() => {
                    const updated = [...nodes, n];
                    setNodes(updated);
                    if (!answer.includes(n)) {
                      setAnswer((prev) =>
                        prev
                          ? `${prev}\nArchitecture flow: ${updated.join(" -> ")}`
                          : `Architecture flow: ${updated.join(" -> ")}`,
                      );
                    }
                  }}
                >
                  <Plus size={14} />
                  {n}
                </Button>
              ))}
            </div>
            <div className="whiteboard">
              {!nodes.length && (
                <span className="meta-line">
                  Click components above to connect your request pipeline (drag nodes to reorder).
                </span>
              )}
              {nodes.map((n, i) => (
                <div className="whiteboard-step" key={`${n}-${i}`}>
                  <div
                    draggable
                    className="whiteboard-node"
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = Number(e.dataTransfer.getData("text/plain"));
                      const nextNodes = [...nodes];
                      const a = nextNodes[i];
                      const b = nextNodes[from];
                      if (!a || !b) return;
                      nextNodes[i] = b;
                      nextNodes[from] = a;
                      setNodes(nextNodes);
                    }}
                  >
                    <span>{n}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Remove node"
                      onClick={() => setNodes(nodes.filter((_, j) => j !== i))}
                    >
                      ×
                    </Button>
                  </div>
                  {i < nodes.length - 1 && <ArrowRight size={15} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {coding && (
          <div className="stack">
            <div className="row wrap">
              <Button variant="outline" onClick={runCodingRound} disabled={Boolean(review)}>
                <Play size={15} /> Run tests
              </Button>
            </div>
            {codeExec && (
              <div className="stack">
                {codeExec.compileError ? (
                  <div className="notice warning" style={{ marginBottom: 0 }}>
                    {codeExec.compileError}
                  </div>
                ) : (
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
                      {codeExec.results.map((r) => (
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
                              {r.passed ? "PASS" : "FAIL"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {sql && (
          <div className="stack">
            <div className="row wrap">
              <Button variant="outline" onClick={() => void runSQL()} disabled={Boolean(review)}>
                <Play size={15} /> Run & grade SQL
              </Button>
            </div>
            {sqlVerdict && (
              <div
                className={`notice ${sqlVerdict.passed ? "" : "warning"}`}
                style={{ marginBottom: 0 }}
              >
                {sqlVerdict.feedback}
              </div>
            )}
            {sqlOutput.length > 0 && (
              <pre className="code-block">{JSON.stringify(sqlOutput, null, 2)}</pre>
            )}
          </div>
        )}

        {hint && (
          <p className="notice" style={{ marginBottom: 0 }}>
            {q.hint}
          </p>
        )}

        <div className="session-actions">
          <Button
            variant="outline"
            disabled={assessment || Boolean(review) || hint}
            onClick={() => {
              setHint(true);
              setAssisted(true);
            }}
          >
            {assessment ? "Hints locked" : "Show hint (marks assisted)"}
          </Button>
          <Button disabled={busy || Boolean(review)} onClick={submit}>
            {busy ? "Saving…" : "Submit answer"}
            <Check />
          </Button>
        </div>
      </section>

      {review && (
        <section className="feedback">
          <div className="row between wrap">
            <h3>{review.result.score}/100 · Round evaluated</h3>
            <span className="pill">{review.assisted ? "Practiced with help" : "Unassisted"}</span>
          </div>
          <p>{review.result.feedback}</p>
          <div className="grid-two mt-4">
            {(["correctness", "coverage", "depth", "clarity"] as const).map((k) => (
              <div className="skill-line" key={k}>
                <div className="row between">
                  <span>{k}</span>
                  <span className="tabular-nums">{review.result[k]}/10</span>
                </div>
                <progress max={10} value={review.result[k]} />
              </div>
            ))}
          </div>
          <p className="meta-line mt-3">
            Deterministic rubric estimate based on executed tests or concept coverage.
          </p>
          <Button className="mt-4" onClick={next}>
            {index + 1 === qs.length ? "Finish & view report" : "Next question"}
            <ArrowRight />
          </Button>
        </section>
      )}
    </div>
  );
}
