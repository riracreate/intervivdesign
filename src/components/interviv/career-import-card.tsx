import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Briefcase,
  Check,
  FileSpreadsheet,
  FileText,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/interviv/workspace";
import {
  buildCareerGapRoadmap,
  SAMPLE_LINKEDIN_HISTORY_CSV,
  type CareerImportResult,
  type CareerImportSource,
  type CareerRoleEntry,
} from "@/lib/interviv/career-import";
import {
  parseResumeTextForRoadmap,
  processResumeFile,
  syncResumeToSkillGapRoadmap,
} from "@/lib/interviv/resume-service";
import { getRoleTargetSkills, SAMPLE_RESUME_TEXT } from "@/lib/interviv/resume-extractor";
import { isAllowedOAuthOrigin, type LinkedInOAuthProfile } from "@/lib/interviv/linkedin-oauth";
import { ArrowRight } from "./ui";
import { toast } from "sonner";

function LinkedInMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77Z" />
    </svg>
  );
}

export function CareerImportCard({
  scores,
}: {
  scores: Array<{ skill: string; score: number; attempts: number }>;
}) {
  const { user, data, update } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [oauthSetupNote, setOauthSetupNote] = useState<{
    message: string;
    redirectUri: string;
  } | null>(null);

  // Staged resume/career extraction awaiting explicit user confirmation before syncing to roadmap
  const [pendingDraft, setPendingDraft] = useState<CareerImportResult | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftHeadline, setDraftHeadline] = useState("");
  const [draftSkills, setDraftSkills] = useState<string[]>([]);
  const [draftRoles, setDraftRoles] = useState<CareerRoleEntry[]>([]);
  const [newSkillInput, setNewSkillInput] = useState("");
  const [addingRole, setAddingRole] = useState(false);
  const [newRoleTitle, setNewRoleTitle] = useState("");
  const [newRoleCompany, setNewRoleCompany] = useState("");
  const [newRolePeriod, setNewRolePeriod] = useState("");

  const history = data.careerHistory ?? null;
  const extracted = data.extractedResume ?? null;

  const stageCareerDraft = (opts: {
    rawText: string;
    source: CareerImportSource;
    fileName?: string | undefined;
    oauthIdentity?: Partial<LinkedInOAuthProfile> | undefined;
  }) => {
    const result = parseResumeTextForRoadmap({
      rawText: opts.rawText,
      targetRole: data.role,
      source: opts.source,
      fileName: opts.fileName,
      oauthIdentity: opts.oauthIdentity,
      measuredScores: scores,
    });

    setPendingDraft(result);
    setDraftName(result.history.fullName);
    setDraftHeadline(result.history.headline);
    setDraftSkills(result.history.extractedSkills);
    setDraftRoles(result.history.roles);
    setNewSkillInput("");
    setAddingRole(false);

    toast.info(
      `Parsed ${result.history.extractedSkills.length} skill(s) & ${result.history.roles.length} role(s) — confirm below to sync with your roadmap.`,
    );
    return result;
  };

  const draftGapPreview = useMemo(() => {
    if (!pendingDraft) return [];
    return buildCareerGapRoadmap({
      targetRole: data.role,
      extractedSkills: draftSkills,
      measuredScores: scores,
    });
  }, [pendingDraft, data.role, draftSkills, scores]);

  const roadmapPreview = useMemo(() => {
    const skillsList = history?.extractedSkills ?? extracted?.allSkills ?? [];
    if (!history && !extracted) return [];
    return buildCareerGapRoadmap({
      targetRole: data.role,
      extractedSkills: skillsList,
      measuredScores: scores,
    });
  }, [history, extracted, data.role, scores]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isAllowedOAuthOrigin(event.origin)) return;
      const payload = event.data as
        { type?: string; profile?: LinkedInOAuthProfile; message?: string } | undefined;
      if (!payload || typeof payload !== "object") return;
      if (payload.type === "LINKEDIN_OAUTH_SUCCESS" && payload.profile) {
        setOauthBusy(false);
        setOauthSetupNote(null);
        const profile = payload.profile;
        const baseText =
          pendingDraft?.rawText ||
          data.resume.trim() ||
          [
            profile.fullName,
            profile.email,
            profile.headline || `${data.role} candidate`,
            profile.location,
          ]
            .filter(Boolean)
            .join("\n");
        stageCareerDraft({
          rawText: baseText,
          source: "linkedin-oauth",
          oauthIdentity: profile,
        });
      } else if (payload.type === "LINKEDIN_OAUTH_ERROR") {
        setOauthBusy(false);
        toast.error(payload.message || "LinkedIn OAuth could not complete.");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.resume, data.role, scores, pendingDraft]);

  async function handleConnectLinkedIn() {
    setOauthBusy(true);
    setOauthSetupNote(null);
    try {
      const res = await fetch("/api/linkedin/url");
      if (!res.ok) throw new Error("Could not reach LinkedIn OAuth endpoint.");
      const json = (await res.json()) as {
        configured: boolean;
        url?: string;
        redirectUri: string;
        message?: string;
      };
      if (!json.configured || !json.url) {
        setOauthSetupNote({
          message:
            json.message ??
            "LinkedIn client credentials are not configured yet. Add them in environment variables or drop your PDF resume right beside.",
          redirectUri: json.redirectUri,
        });
        setOauthBusy(false);
        return;
      }
      const popup = window.open(json.url, "interviv_linkedin_oauth", "width=600,height=700");
      if (!popup) {
        setOauthBusy(false);
        toast.error("Allow popups in your browser to complete LinkedIn OAuth sign-in.");
      }
    } catch (e) {
      setOauthBusy(false);
      toast.error(e instanceof Error ? e.message : "LinkedIn connection failed.");
    }
  }

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const { document, parsed } = await processResumeFile(file, {
        targetRole: data.role,
        measuredScores: scores,
      });
      setPendingDraft(parsed);
      setDraftName(parsed.history.fullName);
      setDraftHeadline(parsed.history.headline);
      setDraftSkills(parsed.history.extractedSkills);
      setDraftRoles(parsed.history.roles);
      setNewSkillInput("");
      setAddingRole(false);
      toast.info(
        `Parsed ${parsed.history.extractedSkills.length} skill(s) & ${parsed.history.roles.length} role(s) from ${document.fileName} (${document.pageCount} page${document.pageCount === 1 ? "" : "s"}) — confirm below to sync with your roadmap.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read resume or history file.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmAndSync() {
    if (!pendingDraft) return;
    const { finalized, snapshot } = await syncResumeToSkillGapRoadmap({
      draft: pendingDraft,
      targetRole: data.role,
      confirmedFullName: draftName,
      confirmedHeadline: draftHeadline,
      confirmedSkills: draftSkills,
      confirmedRoles: draftRoles,
      measuredScores: scores,
      updateWorkspace: (patch) => update(patch),
    });

    setPendingDraft(null);
    toast.success(
      `Confirmed & synced ${finalized.history.extractedSkills.length} skill(s) and ${finalized.history.roles.length} role(s) — ${snapshot.totalGaps} roadmap gap(s) prioritized.`,
    );
  }

  function handleDiscardDraft() {
    setPendingDraft(null);
    setAddingRole(false);
    toast.info("Discarded parsed resume draft. Roadmap was not changed.");
  }

  async function handleClearImport() {
    setPendingDraft(null);
    await update({
      careerHistory: null,
      extractedResume: null,
      skillGapRoadmap: null,
      resume: "",
    });
    toast.info("Cleared imported resume & career history from dashboard.");
  }

  function handleAddSkill() {
    const clean = newSkillInput.trim();
    if (!clean) return;
    if (!draftSkills.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setDraftSkills((prev) => [...prev, clean]);
    }
    setNewSkillInput("");
  }

  function handleAddRole() {
    const title = newRoleTitle.trim();
    const company = newRoleCompany.trim();
    if (!title && !company) return;
    setDraftRoles((prev) => [
      {
        title: title || "Software Engineer",
        company: company || "Organization",
        period: newRolePeriod.trim() || "Experience",
        highlights: [],
        skills: [],
      },
      ...prev,
    ]);
    setNewRoleTitle("");
    setNewRoleCompany("");
    setNewRolePeriod("");
    setAddingRole(false);
  }

  const missingGaps = roadmapPreview.filter((g) => !g.inHistory);
  const topMissingSkill = missingGaps[0]?.skill ?? roadmapPreview[0]?.skill ?? "DSA";
  const draftMissingGaps = draftGapPreview.filter((g) => !g.inHistory);
  const suggestedRoleSkills = getRoleTargetSkills(data.role).filter(
    (s) => !draftSkills.some((existing) => existing.toLowerCase() === s.toLowerCase()),
  );

  return (
    <section
      className="panel stack career-import-card"
      aria-labelledby="career-import-heading"
      data-testid="career-import-card"
    >
      <div className="row between wrap" style={{ gap: 12 }}>
        <div style={{ flex: "1 1 340px" }}>
          <div className="eyebrow">Resume PDF &amp; LinkedIn Sync</div>
          <h2 id="career-import-heading">Upload resume or sync career history</h2>
          <p className="tiny text-muted" style={{ marginTop: 4 }}>
            Drag &amp; drop your PDF resume, LinkedIn <code>Positions.csv</code>, or connect
            LinkedIn OAuth. Review extracted skills and work experience before syncing to your
            roadmap.{!user && " Works in preview mode; sign in to save across sessions."}
          </p>
        </div>
        <div className="row wrap">
          {pendingDraft ? (
            <span className="pill warning">Pending confirmation · Not synced yet</span>
          ) : history ? (
            <>
              <span className="pill">
                <Check size={13} /> {history.sourceLabel} · {history.extractedSkills.length} skills
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClearImport}
                aria-label="Clear career import"
              >
                <Trash2 size={14} /> Clear
              </Button>
            </>
          ) : (
            <span className="pill">PDF · CSV · JSON · TXT</span>
          )}
        </div>
      </div>

      <div className="career-import-grid">
        {/* LEFT COLUMN: DRAG-AND-DROP PDF RESUME UPLOAD ZONE */}
        <div
          className={`career-upload-zone ${dragActive ? "drag-active" : ""}`}
          data-testid="resume-dropzone"
          onDragEnter={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setDragActive(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            aria-label="Upload PDF resume or LinkedIn export file"
            accept=".pdf,.csv,.json,.txt,.md"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />

          <div className="row between">
            <div className="row" style={{ gap: 10 }}>
              <span className="icon-box">
                <FileText size={18} />
              </span>
              <div>
                <h3>Drag &amp; drop PDF resume</h3>
                <span className="tiny text-muted">
                  Parsed locally with pdf.js · PDF, Positions.csv, JSON, or TXT
                </span>
              </div>
            </div>
            {dragActive && <span className="pill">Drop file to extract</span>}
          </div>

          <p className="small text-muted">
            {dragActive
              ? "Release to parse skills and work experience for review…"
              : "Drop your resume PDF or LinkedIn export here to extract key skills and work experience, then confirm before syncing."}
          </p>

          <div className="row wrap">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={15} />
              {busy ? "Parsing PDF…" : "Choose PDF or resume"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                stageCareerDraft({
                  rawText: SAMPLE_RESUME_TEXT,
                  source: "file-upload",
                  fileName: "maya-kulkarni-resume.pdf",
                })
              }
            >
              <Sparkles size={14} /> Try sample resume
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                stageCareerDraft({
                  rawText: SAMPLE_LINKEDIN_HISTORY_CSV,
                  source: "linkedin-csv",
                  fileName: "Positions.csv",
                })
              }
            >
              <FileSpreadsheet size={14} /> Sample LinkedIn CSV
            </Button>
          </div>
        </div>

        {/* RIGHT COLUMN: LINKEDIN OAUTH & TEXT PASTE */}
        <div className="career-import-pane">
          <div className="row between">
            <div className="row" style={{ gap: 10 }}>
              <span className="icon-box">
                <LinkedInMark />
              </span>
              <div>
                <h3>Connect via LinkedIn</h3>
                <span className="tiny text-muted">OpenID profile popup sync</span>
              </div>
            </div>
          </div>

          <p className="small text-muted">
            Sign in with LinkedIn to pull your verified name and profile header cleanly via popup
            OAuth, or paste your LinkedIn About &amp; Experience summary directly.
          </p>

          <div className="row wrap">
            <Button
              type="button"
              onClick={handleConnectLinkedIn}
              disabled={oauthBusy}
              className="linkedin-oauth-btn"
            >
              <LinkedInMark />
              {oauthBusy ? "Waiting for LinkedIn…" : "Connect LinkedIn"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPasteOpen((v) => !v)}
            >
              {pasteOpen ? "Hide text input" : "Paste resume / summary"}
            </Button>
          </div>

          {oauthSetupNote && (
            <div className="notice warning career-oauth-note" role="status">
              <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
                <AlertCircle size={16} style={{ marginTop: 2 }} />
                <div className="stack" style={{ gap: 4 }}>
                  <strong className="small">LinkedIn OAuth credentials needed</strong>
                  <span className="tiny">{oauthSetupNote.message}</span>
                  <span className="tiny">
                    Callback URI: <code>{oauthSetupNote.redirectUri}</code>
                  </span>
                </div>
              </div>
            </div>
          )}

          {pasteOpen && (
            <div className="stack" style={{ gap: 8, marginTop: 4 }}>
              <textarea
                rows={4}
                aria-label="Paste resume or LinkedIn experience text"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste your resume, LinkedIn About, Experience roles, and Skills section…"
              />
              <Button
                type="button"
                size="sm"
                disabled={!pasteText.trim()}
                onClick={() => {
                  stageCareerDraft({ rawText: pasteText, source: "pasted-text" });
                  setPasteOpen(false);
                }}
              >
                Parse for review <ArrowRight />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* STEP 2: USER CONFIRMATION PANEL BEFORE SYNCING TO ROADMAP */}
      {pendingDraft && (
        <div className="resume-draft-review" data-testid="resume-draft-review">
          <div className="row between wrap" style={{ gap: 12 }}>
            <div style={{ flex: "1 1 340px" }}>
              <div className="eyebrow">Step 2 · Confirm Extracted Resume Data</div>
              <h3>Review parsed skills &amp; work experience before syncing</h3>
              <p className="tiny text-muted" style={{ marginTop: 2 }}>
                Source:{" "}
                <strong>{pendingDraft.history.fileName || pendingDraft.history.sourceLabel}</strong>
                {" · "}Confirm or edit below — your personalized roadmap updates only after you
                click Confirm &amp; sync.
              </p>
            </div>
            <div className="row wrap">
              <Button type="button" variant="outline" size="sm" onClick={handleDiscardDraft}>
                Cancel &amp; discard
              </Button>
              <Button type="button" size="sm" onClick={handleConfirmAndSync}>
                <Check size={15} /> Confirm &amp; sync to roadmap
              </Button>
            </div>
          </div>

          <div className="resume-draft-fields">
            <label className="tiny">
              Candidate name
              <input
                aria-label="Confirm candidate name"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Your name"
              />
            </label>
            <label className="tiny">
              Headline / current role
              <input
                aria-label="Confirm headline or role"
                value={draftHeadline}
                onChange={(e) => setDraftHeadline(e.target.value)}
                placeholder="e.g., Senior Software Engineer"
              />
            </label>
          </div>

          <div className="career-result-grid" style={{ borderTop: 0, paddingTop: 0 }}>
            {/* EDITABLE EXTRACTED SKILLS */}
            <div className="career-result-col stack" style={{ gap: 10 }}>
              <div className="row between wrap">
                <strong className="small">Extracted Key Skills ({draftSkills.length})</strong>
                <span className="tiny text-muted">Click × to remove or add missing skills</span>
              </div>

              {draftSkills.length > 0 ? (
                <div className="chip-group">
                  {draftSkills.map((skill) => (
                    <span className="pill draft-skill-chip" key={skill}>
                      {skill}
                      <button
                        type="button"
                        className="draft-chip-remove"
                        aria-label={`Remove skill ${skill}`}
                        onClick={() =>
                          setDraftSkills((prev) => prev.filter((item) => item !== skill))
                        }
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="tiny text-muted">
                  No skills kept yet — add skills below or pick from target-role suggestions.
                </p>
              )}

              <div className="row" style={{ gap: 8 }}>
                <input
                  aria-label="Add extracted skill"
                  value={newSkillInput}
                  onChange={(e) => setNewSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSkill();
                    }
                  }}
                  placeholder="Add skill (e.g. Python, Kubernetes)…"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddSkill}
                  disabled={!newSkillInput.trim()}
                >
                  <Plus size={14} /> Add
                </Button>
              </div>

              {suggestedRoleSkills.length > 0 && (
                <div className="stack" style={{ gap: 6 }}>
                  <span className="tiny text-muted">
                    Quick-add if you know these ({data.role}):
                  </span>
                  <div className="chip-group">
                    {suggestedRoleSkills.slice(0, 5).map((s) => (
                      <button
                        type="button"
                        key={s}
                        className="chip"
                        onClick={() => setDraftSkills((prev) => [...prev, s])}
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="draft-gap-preview">
                <div className="tiny text-muted" style={{ marginBottom: 6 }}>
                  WILL QUEUE ON ROADMAP ({draftMissingGaps.length} MISSING FOR{" "}
                  {data.role.toUpperCase()})
                </div>
                <div className="chip-group">
                  {draftMissingGaps.length > 0 ? (
                    draftMissingGaps.map((g) => (
                      <span className="pill warning" key={g.skill}>
                        Gap: {g.skill}
                      </span>
                    ))
                  ) : (
                    <span className="pill">
                      <Check size={12} /> All {data.role} target skills covered
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* EDITABLE EXTRACTED WORK EXPERIENCE */}
            <div className="career-result-col stack" style={{ gap: 10 }}>
              <div className="row between wrap">
                <strong className="small">Extracted Work Experience ({draftRoles.length})</strong>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setAddingRole((v) => !v)}
                >
                  <Plus size={14} /> {addingRole ? "Close form" : "Add role"}
                </Button>
              </div>

              {addingRole && (
                <div className="draft-add-role">
                  <input
                    aria-label="New role title"
                    value={newRoleTitle}
                    onChange={(e) => setNewRoleTitle(e.target.value)}
                    placeholder="Role title (e.g. Backend Engineer)"
                  />
                  <input
                    aria-label="New role company"
                    value={newRoleCompany}
                    onChange={(e) => setNewRoleCompany(e.target.value)}
                    placeholder="Company (e.g. Acme Cloud)"
                  />
                  <div className="row" style={{ gap: 8 }}>
                    <input
                      aria-label="New role timeframe"
                      value={newRolePeriod}
                      onChange={(e) => setNewRolePeriod(e.target.value)}
                      placeholder="Period (e.g. 2022 – Present)"
                    />
                    <Button type="button" size="sm" variant="secondary" onClick={handleAddRole}>
                      Add role
                    </Button>
                  </div>
                </div>
              )}

              {draftRoles.length > 0 ? (
                <div className="career-roles-list">
                  {draftRoles.map((role, idx) => (
                    <article
                      className="career-role-item"
                      key={`${role.company}-${role.title}-${idx}`}
                    >
                      <div className="row between wrap" style={{ gap: 8 }}>
                        <strong className="small">
                          <Briefcase size={13} style={{ display: "inline", marginRight: 6 }} />
                          {role.title} · {role.company}
                        </strong>
                        <div className="row" style={{ gap: 6 }}>
                          <span className="tiny text-muted">{role.period}</span>
                          <button
                            type="button"
                            className="draft-role-remove"
                            aria-label={`Remove role ${role.title} at ${role.company}`}
                            onClick={() =>
                              setDraftRoles((prev) => prev.filter((_, rIdx) => rIdx !== idx))
                            }
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      {role.highlights.length > 0 && (
                        <ul className="draft-highlights-list">
                          {role.highlights.slice(0, 2).map((h, hIdx) => (
                            <li key={hIdx} className="tiny text-muted">
                              {h}
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="tiny text-muted">
                  No dated role headers detected yet — click &ldquo;Add role&rdquo; above or confirm
                  with extracted skills alone.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMED & SYNCED HISTORY + POPULATED ROADMAP SUMMARY */}
      {!pendingDraft && history && (
        <div className="career-result-grid" data-testid="career-import-results">
          <div className="career-result-col">
            <div className="row between wrap" style={{ marginBottom: 10 }}>
              <div>
                <div className="tiny text-muted">CONFIRMED PROFESSIONAL HISTORY</div>
                <h3 style={{ marginTop: 2 }}>{history.fullName}</h3>
                <div className="tiny text-muted">
                  {history.headline}
                  {history.yearsEstimated > 0 ? ` · ~${history.yearsEstimated} yrs` : ""}
                  {history.location ? ` · ${history.location}` : ""}
                </div>
              </div>
              <span className="pill">{history.roles.length} roles synced</span>
            </div>

            {history.roles.length > 0 ? (
              <div className="career-roles-list">
                {history.roles.slice(0, 3).map((role, idx) => (
                  <article
                    className="career-role-item"
                    key={`${role.company}-${role.title}-${idx}`}
                  >
                    <div className="row between wrap">
                      <strong className="small">
                        <Briefcase size={13} style={{ display: "inline", marginRight: 6 }} />
                        {role.title} · {role.company}
                      </strong>
                      <span className="tiny text-muted">{role.period}</span>
                    </div>
                    {role.skills.length > 0 && (
                      <div className="chip-group" style={{ marginTop: 6 }}>
                        {role.skills.slice(0, 5).map((s) => (
                          <span className="pill" key={s}>
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="small text-muted">
                Confirmed {history.extractedSkills.length} technical skill(s) from your profile.
                Drop a PDF resume or <code>Positions.csv</code> to display dated role entries.
              </p>
            )}
          </div>

          <div className="career-result-col">
            <div className="row between wrap" style={{ marginBottom: 10 }}>
              <div>
                <div className="tiny text-muted">POPULATED SKILL-GAP ROADMAP ({data.role})</div>
                <h3 style={{ marginTop: 2 }}>
                  {missingGaps.length > 0
                    ? `${missingGaps.length} target skill gap(s) prioritized`
                    : "All role target skills verified in history"}
                </h3>
              </div>
              <Link to="/roadmap" className="text-link">
                Open full roadmap <ArrowRight />
              </Link>
            </div>

            {missingGaps.length > 0 && (
              <div className="chip-group" style={{ marginBottom: 12 }}>
                {missingGaps.map((g) => (
                  <Link
                    key={g.skill}
                    to="/practice"
                    search={{ skill: g.skill }}
                    className="pill warning"
                  >
                    Gap: {g.skill}
                  </Link>
                ))}
              </div>
            )}

            <div className="career-roadmap-preview">
              {roadmapPreview.slice(0, 3).map((item, idx) => (
                <div className="career-roadmap-row" key={item.skill}>
                  <span className="how-step-num" style={{ width: 28, height: 28, fontSize: 11 }}>
                    0{idx + 1}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="small" style={{ fontWeight: 650 }}>
                      {item.skill}
                    </div>
                    <div className="tiny text-muted">{item.recommendedAction}</div>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/practice" search={{ skill: item.skill }}>
                      Practice
                    </Link>
                  </Button>
                </div>
              ))}
            </div>

            <div className="row wrap" style={{ marginTop: 12 }}>
              <Button size="sm" asChild>
                <Link to="/practice" search={{ skill: topMissingSkill }}>
                  Start top gap ({topMissingSkill}) <ArrowRight />
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/gap-analysis">Compare benchmarks</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
