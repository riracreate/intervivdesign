import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/interviv/workspace";
import { skills, modes, makeQuestions } from "@/lib/interviv/data";
import { Heading, Icon, ArrowRight, Plus, AuthPrompt } from "./ui";
import { toast } from "sonner";
export function Practice({ initialMode = "interview" }: { initialMode?: string | undefined }) {
  const { user, data, update, saveSession } = useWorkspace();
  const nav = useNavigate();
  const [mode, setMode] = useState(initialMode);
  const [focus, setFocus] = useState(["DBMS", "DSA"]);
  const [duration, setDuration] = useState(15);
  const [count, setCount] = useState(3);
  const [assessment, setAssessment] = useState(false);
  const [query, setQuery] = useState("");
  const [blocks, setBlocks] = useState(["oa", "sql", "interview"]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = modes.find((m) => m.id === mode) ?? modes[0];
  if (!selected) return null;
  async function start() {
    if (!selected) return;
    if (!user) {
      toast.info("Sign in to start and save your practice.");
      return;
    }
    if (!focus.length) {
      toast.error("Choose at least one skill.");
      return;
    }
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const roundCount =
        mode === "full" ? focus.length * count : mode === "custom" ? blocks.length * count : count;
      await saveSession({
        id,
        title: selected.title,
        mode,
        skills: focus,
        rounds: [],
        status: "in_progress",
        score: null,
        assisted: false,
        created_at: new Date().toISOString(),
        draft: {
          questions:
            mode === "custom"
              ? blocks.flatMap((b) => makeQuestions(b, focus, count))
              : makeQuestions(mode, focus, roundCount),
          answer: "",
          index: 0,
          assessment,
          duration,
          blocks,
          deadline: assessment ? Date.now() + duration * 60000 : null,
        },
      });
      await nav({ to: "/session/$sessionId", params: { sessionId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start your session.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="Make time for your next chapter"
        title="How do you want to practice?"
        subtitle="Choose a focus. Make it yours. A little progress starts here."
      />
      {!user && <AuthPrompt />}
      <div className="two-column">
        <div>
          <div className="mode-grid">
            {modes.map((m) => (
              <Button
                variant="ghost"
                key={m.id}
                className={`mode-card ${m.id === mode ? "selected" : ""}`}
                onClick={() => setMode(m.id)}
                aria-pressed={m.id === mode}
              >
                <div>
                  <span className="select-circle" />
                  <span className={`icon-box ${m.tone}`}>
                    <Icon name={m.icon} />
                  </span>
                  <h3>{m.title}</h3>
                  <p>{m.description}</p>
                  <span className="pill">{m.time}</span>
                </div>
              </Button>
            ))}
          </div>
        </div>
        <section className="panel setup-panel">
          <h2>Make this session yours.</h2>
          <p>{selected.description}</p>
          <div className="form-stack">
            <label>
              Your focus
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a skill…"
              />
            </label>
            <div className="chip-group">
              {skills
                .filter((s) => s.toLowerCase().includes(query.toLowerCase()))
                .slice(0, query ? 20 : 8)
                .map((s) => (
                  <Button
                    variant="ghost"
                    className={`chip ${focus.includes(s) ? "selected" : ""}`}
                    key={s}
                    onClick={() =>
                      setFocus((f) => (f.includes(s) ? f.filter((x) => x !== s) : [...f, s]))
                    }
                  >
                    {s} {focus.includes(s) ? "✓" : "+"}
                  </Button>
                ))}
            </div>
            {query && !skills.some((s) => s.toLowerCase() === query.toLowerCase()) && (
              <Button
                variant="outline"
                onClick={() => {
                  setFocus([...focus, query]);
                  setQuery("");
                }}
              >
                <Plus /> Add {query}
              </Button>
            )}
            <label>
              Time you have
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                <option value={15}>15 minutes · A quick boost</option>
                <option value={30}>30 minutes · Find your flow</option>
                <option value={45}>45 minutes · Go a little deeper</option>
                <option value={60}>60 minutes · A full session</option>
              </select>
            </label>
            <label>
              Rounds {mode === "full" ? "per skill" : ""}
              <input
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value))))}
              />
            </label>
            <p className="tiny text-muted">
              Curated fundamentals · Adaptive difficulty is not yet available.
            </p>
            <div className="check-row">
              <input
                id="assessment"
                type="checkbox"
                checked={assessment}
                onChange={(e) => setAssessment(e.target.checked)}
              />
              <label htmlFor="assessment">Assessment · No hints</label>
            </div>
            {mode === "custom" && (
              <>
                <h3>Your interview blocks</h3>
                {blocks.map((b, i) => (
                  <div key={`${b}-${i}`} className="row">
                    <select
                      aria-label={`Block ${i + 1}`}
                      value={b}
                      onChange={(e) =>
                        setBlocks(blocks.map((x, j) => (j === i ? e.target.value : x)))
                      }
                    >
                      {modes
                        .filter((m) => m.id !== "custom" && m.id !== "full")
                        .map((m) => (
                          <option value={m.id} key={m.id}>
                            {m.title}
                          </option>
                        ))}
                    </select>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Move block up"
                      onClick={() => {
                        if (!i) return;
                        const next = [...blocks];
                        const current = next[i];
                        const previous = next[i - 1];
                        if (!current || !previous) return;
                        next[i - 1] = current;
                        next[i] = previous;
                        setBlocks(next);
                      }}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Remove block"
                      onClick={() => setBlocks(blocks.filter((_, j) => j !== i))}
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={() => setBlocks([...blocks, "interview"])}>
                  <Plus /> Add block
                </Button>
                <input
                  placeholder="Preset name"
                  aria-label="Preset name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Button
                  variant="secondary"
                  disabled={!name || !user}
                  onClick={async () => {
                    await update({ presets: [...data.presets, { name, blocks }] });
                    toast.success("Preset saved.");
                  }}
                >
                  Save preset
                </Button>
                {data.presets.map((p) => (
                  <Button key={p.name} variant="outline" onClick={() => setBlocks(p.blocks)}>
                    {p.name}
                  </Button>
                ))}
              </>
            )}
            <div className="setup-summary">
              <span className="text-muted">{focus.length} skills selected</span>
              <strong>{duration} min session</strong>
            </div>
            {["coding", "ml"].includes(mode) && (
              <p className="notice warning">
                Code execution is unavailable. Answers can be saved as unscored drafts.
              </p>
            )}
            <Button className="full" onClick={start} disabled={busy || !focus.length}>
              {busy ? "Starting…" : "Start my session"}
              <ArrowRight />
            </Button>
            <p className="tiny text-muted">
              {assessment
                ? "Timed assessment · Hints locked"
                : "Coached practice · Hints available"}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
