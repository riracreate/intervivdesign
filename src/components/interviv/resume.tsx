import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useWorkspace } from "@/lib/interviv/workspace";
import { skills } from "@/lib/interviv/data";
import { Heading, Icon, ArrowRight, SkillBar } from "./ui";
import { toast } from "sonner";
export function Resume({ onboarding = false }: { onboarding?: boolean }) {
  const { data, update } = useWorkspace();
  const [text, setText] = useState(data.resume);
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [filename, setFilename] = useState("");
  async function read(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Choose a file smaller than 10 MB.");
      return;
    }
    setBusy(true);
    try {
      let content = "";
      if (file.type === "application/pdf") {
        const pdfjs = await import("pdfjs-dist");
        const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
        for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
          const page = await pdf.getPage(i);
          const t = await page.getTextContent();
          content += t.items.map((item) => ("str" in item ? item.str : "")).join(" ") + "\n";
        }
      } else content = await file.text();
      if (!content.trim()) throw new Error("No readable text found. Paste your resume text below.");
      setText(content);
      setFilename(file.name);
      setSelected(skills.filter((s) => content.toLowerCase().includes(s.toLowerCase())));
      await update({ resume: content });
      toast.success("Resume text extracted.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read this file.");
    } finally {
      setBusy(false);
    }
  }
  const target = jd
    ? skills.filter((s) => jd.toLowerCase().includes(s.toLowerCase()))
    : ["DSA", "DBMS", "Python", "SQL", "System design"];
  const matched = target.filter((s) => text.toLowerCase().includes(s.toLowerCase()));
  const missing = target.filter((s) => !matched.includes(s));
  const sections = ["experience", "education", "skills", "projects"].filter((s) =>
    text.toLowerCase().includes(s),
  );
  const score = Math.round(
    (matched.length / Math.max(target.length, 1)) * 60 +
      (sections.length / 4) * 30 +
      (text.length > 300 ? 10 : 0),
  );
  return (
    <>
      <Heading
        eyebrow="Make your experience count"
        title={onboarding ? "Start with what makes you, you." : "Your story. A little stronger."}
        subtitle={
          onboarding
            ? "Bring your resume, or choose a few skills to begin."
            : "Find what’s working, what’s missing, and your next small improvement."
        }
      />
      {onboarding && (
        <div className="chip-group mb-6">
          {["Upload / domains", "Choose skills", "Your rotation"].map((s, i) => (
            <Button
              key={s}
              variant={step === i + 1 ? "secondary" : "outline"}
              onClick={() => setStep(i + 1)}
            >
              {i + 1}. {s}
            </Button>
          ))}
        </div>
      )}
      {step === 1 && (
        <div className="two-column">
          <section className="stack">
            <div className="dropzone">
              <span className="icon-box">
                <Icon name="book" />
              </span>
              <h2>Bring your experience along.</h2>
              <p>PDF or plain text · Up to 10 MB</p>
              <input
                type="file"
                aria-label="Upload resume"
                accept=".pdf,.txt"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) read(f);
                }}
              />
              <p>{busy ? "Reading your resume…" : filename}</p>
            </div>
            <label>
              Or paste your resume
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Your experience, projects, education and skills…"
              />
            </label>
            {onboarding && (
              <>
                <h3>Or start with your interests.</h3>
                <div className="chip-group">
                  {skills.slice(0, 14).map((s) => (
                    <Button
                      className={`chip ${selected.includes(s) ? "selected" : ""}`}
                      variant="ghost"
                      key={s}
                      onClick={() =>
                        setSelected(
                          selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s],
                        )
                      }
                    >
                      {s}
                    </Button>
                  ))}
                </div>
                <Button onClick={() => setStep(2)}>
                  Choose my skills <ArrowRight />
                </Button>
              </>
            )}
          </section>
          <section className="panel form-stack">
            <h2>Make it relevant to your next role.</h2>
            <label>
              Target role
              <input value={data.role} onChange={(e) => update({ role: e.target.value })} />
            </label>
            <label>
              Job description (optional)
              <textarea
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="Paste the role you’re working toward…"
              />
            </label>
            <Button
              disabled={busy || !text.trim()}
              onClick={async () => {
                await update({ resume: text });
                setAnalyzed(true);
              }}
            >
              Check my resume <ArrowRight />
            </Button>
            <p className="tiny text-muted">
              An explainable keyword and section check. Not an employer ATS or a hiring prediction.
            </p>
          </section>
        </div>
      )}
      {step === 2 && (
        <section className="panel stack">
          <h2>Choose your practice focus.</h2>
          <div className="chip-group">
            {skills.map((s) => (
              <Button
                key={s}
                variant="ghost"
                className={`chip ${selected.includes(s) ? "selected" : ""}`}
                onClick={() =>
                  setSelected(
                    selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s],
                  )
                }
              >
                {s} {selected.includes(s) ? "✓" : "+"}
              </Button>
            ))}
          </div>
          <p className="small text-muted">
            {selected.length} skills · {selected.length * 3} total rounds
          </p>
          <Button disabled={!selected.length} onClick={() => setStep(3)}>
            See my rotation <ArrowRight />
          </Button>
        </section>
      )}
      {step === 3 && (
        <section className="panel stack">
          <h2>Your interview, one skill at a time.</h2>
          {selected.map((s, i) => (
            <div className="row between" key={s}>
              <span>
                Rounds {i * 3 + 1}–{i * 3 + 3}
              </span>
              <span className="pill">{s}</span>
            </div>
          ))}
          <Button asChild>
            <Link to="/practice" search={{ mode: "full" }}>
              Set up my interview <ArrowRight />
            </Link>
          </Button>
        </section>
      )}
      {analyzed && (
        <div className="grid-two mt-6">
          <div className="score-display">
            <h2>Resume alignment</h2>
            <strong>{score}%</strong>
            <p>Rule-based estimate for {data.role}</p>
            <SkillBar
              label="Keywords"
              value={Math.round((matched.length / Math.max(1, target.length)) * 100)}
            />
            <SkillBar label="Section completeness" value={sections.length * 25} />
          </div>
          <section className="panel stack">
            <h2>Small edits. A stronger story.</h2>
            <h3>Matched skills</h3>
            <div className="chip-group">
              {matched.map((s) => (
                <span key={s} className="pill">
                  {s}
                </span>
              ))}
              {!matched.length && (
                <span className="small text-muted">No exact target skill keywords found.</span>
              )}
            </div>
            <h3>Skills to consider</h3>
            <div className="chip-group">
              {missing.map((s) => (
                <span key={s} className="pill warning">
                  {s}
                </span>
              ))}
            </div>
            <p className="small text-muted">
              Only add skills you can demonstrate. Show the action you took and a genuine result.
            </p>
            <h3>Give your bullets a little more impact.</h3>
            <p className="small">
              Action + what you built + how it helped. Add a real metric when you have one; never
              invent a result.
            </p>
            <Button variant="outline" asChild>
              <Link to="/resources">
                Find a skill refresher <ArrowRight />
              </Link>
            </Button>
          </section>
        </div>
      )}
    </>
  );
}
