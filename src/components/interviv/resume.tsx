import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useWorkspace } from "@/lib/interviv/workspace";
import { skills } from "@/lib/interviv/data";
import {
  extractResumeProfile,
  SAMPLE_JD_TEXT,
  SAMPLE_RESUME_TEXT,
  type ExtractedResume,
} from "@/lib/interviv/resume-extractor";
import {
  extractResumeDocument,
  parseResumeTextForRoadmap,
  syncResumeToSkillGapRoadmap,
} from "@/lib/interviv/resume-service";
import { Heading, Icon, ArrowRight, SkillBar, Check } from "./ui";
import { toast } from "sonner";

export function Resume({ onboarding = false }: { onboarding?: boolean }) {
  const { data, update, user } = useWorkspace();
  const [text, setText] = useState(data.resume);
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState(false);
  const [analyzed, setAnalyzed] = useState(Boolean(data.extractedResume || data.resume.trim()));
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>(data.extractedResume?.allSkills ?? []);
  const [filename, setFilename] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "bullets" | "skills">("overview");

  useEffect(() => {
    if (data.resume && !text) {
      setText(data.resume);
      setAnalyzed(true);
    }
  }, [data.resume, text]);

  const extracted: ExtractedResume | null = useMemo(() => {
    if (!text.trim()) return data.extractedResume ?? null;
    return extractResumeProfile(text, data.role, jd);
  }, [text, data.role, jd, data.extractedResume]);

  async function persistExtraction(content: string, jobDesc = jd, fileLabel?: string) {
    const profile = extractResumeProfile(content, data.role, jobDesc);
    const draft = parseResumeTextForRoadmap({
      rawText: content,
      targetRole: data.role,
      source: fileLabel ? "file-upload" : "pasted-text",
      fileName: fileLabel,
    });
    setSelected(profile.allSkills);
    setAnalyzed(true);
    await syncResumeToSkillGapRoadmap({
      draft,
      targetRole: data.role,
      confirmedFullName: profile.contact.name,
      confirmedSkills: profile.allSkills,
      confirmedRoles: draft.history.roles,
      updateWorkspace: async (patch) => {
        await update({
          ...patch,
          extractedResume: profile,
        });
      },
    });
    return profile;
  }

  async function read(file: File) {
    setBusy(true);
    try {
      const doc = await extractResumeDocument(file);
      setText(doc.rawText);
      setFilename(doc.fileName);
      const profile = await persistExtraction(doc.rawText, jd, doc.fileName);
      toast.success(`Extracted ${profile.allSkills.length} skills from ${doc.fileName}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read this file.");
    } finally {
      setBusy(false);
    }
  }

  async function loadSample() {
    setText(SAMPLE_RESUME_TEXT);
    setJd(SAMPLE_JD_TEXT);
    setFilename("sample-software-engineer-resume.txt");
    const profile = await persistExtraction(SAMPLE_RESUME_TEXT, SAMPLE_JD_TEXT);
    toast.success(`Sample resume extracted: ${profile.allSkills.length} skills detected.`);
  }

  function downloadJson() {
    if (!extracted) return;
    const blob = new Blob([JSON.stringify(extracted, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "interviv-resume-extract.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded structured resume JSON.");
  }

  const practiceSkillParam = useMemo(() => {
    if (!extracted) return "";
    if (extracted.jdMatch.missing.length > 0)
      return extracted.jdMatch.missing.slice(0, 3).join(",");
    return extracted.allSkills.slice(0, 3).join(",");
  }, [extracted]);

  return (
    <>
      <Heading
        eyebrow="Structured Resume Extractor"
        title={
          onboarding ? "Start with your experience." : "Extract skills, impact, and role gaps."
        }
        subtitle={
          onboarding
            ? "Upload a resume or pick skills to build your first interview rotation."
            : "Parse contact details, categorized skills, education, and bullet-level action & metric audits."
        }
        action={
          <div className="row wrap">
            <Button variant="outline" size="sm" onClick={loadSample}>
              Load sample resume
            </Button>
            {extracted && (
              <Button variant="outline" size="sm" onClick={downloadJson}>
                Export JSON
              </Button>
            )}
          </div>
        }
      />

      {onboarding && (
        <div className="tabs-row">
          {["Upload & extract", "Choose skills", "Your rotation"].map((s, i) => (
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
              <h2>Upload your resume</h2>
              <p>PDF, TXT, or Markdown · Extracted locally in your browser</p>
              <input
                type="file"
                aria-label="Upload resume"
                accept=".pdf,.txt,.md"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void read(f);
                }}
              />
              {filename && <p className="tiny mt-3">Loaded: {filename}</p>}
              {busy && <p className="tiny mt-3">Extracting text…</p>}
            </div>

            <label>
              Resume text (editable)
              <textarea
                style={{ minHeight: 115 }}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your resume text — summary, skills, experience bullets, projects, education…"
              />
            </label>

            {onboarding && (
              <>
                <h3>Or pick skills directly</h3>
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
            <h2>Target role & job description</h2>
            <label>
              Target role
              <input
                value={data.role}
                onChange={(e) => void update({ role: e.target.value })}
                placeholder="e.g., Software Engineer, Backend Engineer"
              />
            </label>
            <label>
              Job description (optional)
              <textarea
                style={{ minHeight: 115 }}
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="Paste a job description to compare required skills against your resume…"
              />
            </label>
            <div className="row wrap">
              <Button
                disabled={busy || !text.trim()}
                onClick={async () => {
                  const profile = await persistExtraction(text);
                  toast.success(
                    user
                      ? `Extracted ${profile.allSkills.length} skills and saved to workspace.`
                      : `Extracted ${profile.allSkills.length} skills for this session.`,
                  );
                }}
              >
                Extract & audit resume <ArrowRight />
              </Button>
              {!jd && (
                <Button variant="ghost" size="sm" onClick={() => setJd(SAMPLE_JD_TEXT)}>
                  Use sample JD
                </Button>
              )}
            </div>
            <p className="meta-line">
              Deterministic section, keyword, verb, and metric audit. Not an automated hiring
              decision.
            </p>
          </section>
        </div>
      )}

      {step === 2 && (
        <section className="panel stack">
          <h2>Choose your practice focus</h2>
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
          <p className="meta-line">
            {selected.length} skills · {selected.length * 3} total rounds
          </p>
          <Button disabled={!selected.length} onClick={() => setStep(3)}>
            See my rotation <ArrowRight />
          </Button>
        </section>
      )}

      {step === 3 && (
        <section className="panel stack">
          <h2>Your interview rotation</h2>
          {selected.map((s, i) => (
            <div className="row between" key={s}>
              <span>
                Rounds {i * 3 + 1}–{i * 3 + 3}
              </span>
              <strong>{s}</strong>
            </div>
          ))}
          <Button asChild>
            <Link to="/practice" search={{ mode: "full", skill: selected.join(",") }}>
              Set up my interview <ArrowRight />
            </Link>
          </Button>
        </section>
      )}

      {analyzed && extracted && (
        <section className="mt-6 stack">
          <div className="metrics">
            <div className="metric">
              <div className="metric-label">Overall alignment</div>
              <div className="metric-value tabular-nums">
                {extracted.score.overall}
                <small>%</small>
              </div>
              <div className="metric-note">
                For {data.role} · {extracted.wordCount} words
              </div>
            </div>
            <div className="metric">
              <div className="metric-label">Skills extracted</div>
              <div className="metric-value tabular-nums">{extracted.allSkills.length}</div>
              <div className="metric-note">
                Across {extracted.skillGroups.length} technical domains
              </div>
            </div>
            <div className="metric">
              <div className="metric-label">Quantified bullets</div>
              <div className="metric-value tabular-nums">
                {extracted.bulletStats.withMetrics}
                <small> / {extracted.bulletStats.total}</small>
              </div>
              <div className="metric-note">
                {extracted.bulletStats.withActionVerbs} start with strong action verbs
              </div>
            </div>
          </div>

          <div className="tabs-row">
            <Button
              variant={activeTab === "overview" ? "secondary" : "outline"}
              onClick={() => setActiveTab("overview")}
            >
              Extracted profile & gaps
            </Button>
            <Button
              variant={activeTab === "skills" ? "secondary" : "outline"}
              onClick={() => setActiveTab("skills")}
            >
              Categorized skills ({extracted.allSkills.length})
            </Button>
            <Button
              variant={activeTab === "bullets" ? "secondary" : "outline"}
              onClick={() => setActiveTab("bullets")}
            >
              Experience bullet audit ({extracted.bulletStats.total})
            </Button>
          </div>

          {activeTab === "overview" && (
            <div className="grid-two">
              <section className="panel stack">
                <div className="row between">
                  <h2>Extracted candidate profile</h2>
                  <span className="meta-line">
                    {extracted.sectionsFound.length}/6 sections found
                  </span>
                </div>
                <div className="stack" style={{ gap: 10 }}>
                  <div>
                    <div className="meta-line">Name</div>
                    <strong>{extracted.contact.name}</strong>
                  </div>
                  <div className="grid-two">
                    <div>
                      <div className="meta-line">Email</div>
                      <div className="small">{extracted.contact.email || "Not detected"}</div>
                    </div>
                    <div>
                      <div className="meta-line">Phone</div>
                      <div className="small">{extracted.contact.phone || "Not detected"}</div>
                    </div>
                  </div>
                  {extracted.contact.links.length > 0 && (
                    <div>
                      <div className="meta-line">Detected links</div>
                      <div className="small">{extracted.contact.links.join(" · ")}</div>
                    </div>
                  )}
                  <div>
                    <div className="meta-line">Sections detected</div>
                    <div className="small">
                      {extracted.sectionsFound.length
                        ? extracted.sectionsFound.join(" · ")
                        : "None detected"}
                    </div>
                  </div>
                  {extracted.education.length > 0 && (
                    <div>
                      <div className="meta-line">Education</div>
                      {extracted.education.map((edu, idx) => (
                        <div className="small" key={idx}>
                          {edu}
                        </div>
                      ))}
                    </div>
                  )}
                  {extracted.certifications.length > 0 && (
                    <div>
                      <div className="meta-line">Certifications</div>
                      {extracted.certifications.map((cert, idx) => (
                        <div className="small" key={idx}>
                          {cert}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="panel stack">
                <h2>Role alignment & skill gaps</h2>
                <SkillBar label="Keyword match" value={extracted.score.keywordAlignment} />
                <SkillBar
                  label="Core section completeness"
                  value={extracted.score.sectionCompleteness}
                />
                <SkillBar label="Action & metric evidence" value={extracted.score.impactEvidence} />
                <div>
                  <div className="meta-line mb-2">
                    Matched target skills ({extracted.jdMatch.matched.length})
                  </div>
                  <div className="small">
                    {extracted.jdMatch.matched.length
                      ? extracted.jdMatch.matched.join(" · ")
                      : "No target keywords detected yet."}
                  </div>
                </div>
                <div>
                  <div className="meta-line mb-2">
                    Missing target skills ({extracted.jdMatch.missing.length})
                  </div>
                  {extracted.jdMatch.missing.length ? (
                    <div className="chip-group">
                      {extracted.jdMatch.missing.map((s) => (
                        <span key={s} className="pill warning">
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="small row">
                      <Check size={16} /> All target role keywords are present.
                    </div>
                  )}
                </div>
                <div className="row wrap">
                  {practiceSkillParam && (
                    <Button asChild>
                      <Link to="/practice" search={{ skill: practiceSkillParam }}>
                        Practice{" "}
                        {extracted.jdMatch.missing.length ? "missing gaps" : "resume skills"}{" "}
                        <ArrowRight />
                      </Link>
                    </Button>
                  )}
                  <Button variant="outline" asChild>
                    <Link to="/roadmap">View updated roadmap</Link>
                  </Button>
                </div>
              </section>
            </div>
          )}

          {activeTab === "skills" && (
            <section className="panel stack">
              <div className="row between wrap">
                <h2>Categorized skills extracted from your resume</h2>
                {extracted.allSkills.length > 0 && (
                  <Button size="sm" asChild>
                    <Link
                      to="/practice"
                      search={{ skill: extracted.allSkills.slice(0, 4).join(",") }}
                    >
                      Practice top extracted skills <ArrowRight />
                    </Link>
                  </Button>
                )}
              </div>
              {extracted.skillGroups.length ? (
                <div className="grid-two">
                  {extracted.skillGroups.map((group) => (
                    <div className="skill-group" key={group.category}>
                      <h4>{group.category}</h4>
                      <div className="chip-group">
                        {group.skills.map((skill) => (
                          <Link
                            key={skill}
                            to="/practice"
                            search={{ skill }}
                            className="chip"
                            title={`Practice ${skill}`}
                          >
                            {skill}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  No technical skills matched yet. Paste a fuller resume or load the sample.
                </div>
              )}
            </section>
          )}

          {activeTab === "bullets" && (
            <section className="panel stack">
              <div className="row between wrap">
                <div>
                  <h2>Experience & project bullet audit</h2>
                  <p className="meta-line">
                    {extracted.bulletStats.withActionVerbs}/{extracted.bulletStats.total} action
                    verbs · {extracted.bulletStats.withMetrics}/{extracted.bulletStats.total}{" "}
                    quantified metrics
                  </p>
                </div>
              </div>
              {extracted.experience.length ? (
                extracted.experience.map((group, gi) => (
                  <div key={gi} className="stack">
                    <h3>{group.header}</h3>
                    {group.bullets.map((b, bi) => (
                      <div className="bullet-audit" key={bi}>
                        <div className="small">• {b.text}</div>
                        <div className="row wrap">
                          <span className={`pill ${b.hasActionVerb ? "" : "warning"}`}>
                            {b.hasActionVerb ? "Action verb OK" : "Weak/missing verb"}
                          </span>
                          <span className={`pill ${b.hasMetric ? "" : "warning"}`}>
                            {b.hasMetric ? "Quantified metric" : "Add genuine metric"}
                          </span>
                        </div>
                        <div className="meta-line">{b.suggestion}</div>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div className="empty">
                  No bullet points detected. Use • or - bullets under Experience or Projects to
                  inspect impact.
                </div>
              )}
            </section>
          )}
        </section>
      )}
    </>
  );
}
