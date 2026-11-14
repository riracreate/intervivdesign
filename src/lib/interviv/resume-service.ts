import {
  finalizeCareerImportDraft,
  importCareerHistory,
  type CareerHistoryProfile,
  type CareerImportResult,
  type CareerImportSource,
  type CareerRoleEntry,
  type PopulatedRoadmapGap,
} from "./career-import";
import { extractPdfTextWithMeta } from "./pdf-parser";
import type { ExtractedResume } from "./resume-extractor";

export const MAX_RESUME_FILE_BYTES = 10 * 1024 * 1024;
export const ROADMAP_UPDATED_EVENT = "interviv:roadmap-updated";

export type ExtractedResumeDocument = {
  fileName: string;
  rawText: string;
  source: CareerImportSource;
  pageCount: number;
};

export type SkillGapRoadmapSnapshot = {
  targetRole: string;
  sourceLabel: string;
  updatedAt: string;
  totalGaps: number;
  missingSkills: string[];
  verifiedSkills: string[];
  items: PopulatedRoadmapGap[];
};

export type MeasuredSkillScore = {
  skill: string;
  score: number;
  attempts: number;
};

export type WorkspaceRoadmapPatch = {
  resume: string;
  extractedResume: ExtractedResume;
  careerHistory: CareerHistoryProfile;
  skillGapRoadmap: SkillGapRoadmapSnapshot;
};

export type SyncResumeResult = {
  finalized: CareerImportResult;
  snapshot: SkillGapRoadmapSnapshot;
};

/**
 * Extracts readable multi-line text from an uploaded resume File (PDF via `pdfjs-dist`
 * or plain text / CSV / JSON files) after enforcing file size and non-empty checks.
 */
export async function extractResumeDocument(file: File): Promise<ExtractedResumeDocument> {
  if (file.size > MAX_RESUME_FILE_BYTES) {
    throw new Error("Choose a file smaller than 10 MB.");
  }

  const lowerName = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");

  let rawText = "";
  let pageCount = 1;

  if (isPdf) {
    const extracted = await extractPdfTextWithMeta(file);
    rawText = extracted.text;
    pageCount = extracted.pageCount;
  } else {
    rawText = await file.text();
  }

  if (!rawText.trim()) {
    throw new Error(
      "No readable text found in this file. Try a text-based PDF resume, LinkedIn CSV, or TXT.",
    );
  }

  const source: CareerImportSource = lowerName.endsWith(".csv") ? "linkedin-csv" : "file-upload";

  return {
    fileName: file.name,
    rawText,
    source,
    pageCount,
  };
}

/**
 * Parses extracted resume or career text into structured key skills, work experience roles,
 * and ranked target-role skill gaps.
 */
export function parseResumeTextForRoadmap(opts: {
  rawText: string;
  targetRole: string;
  source: CareerImportSource;
  fileName?: string | undefined;
  oauthIdentity?:
    | {
        fullName?: string | undefined;
        email?: string | undefined;
        headline?: string | undefined;
        location?: string | undefined;
      }
    | undefined;
  measuredScores?: MeasuredSkillScore[] | undefined;
}): CareerImportResult {
  return importCareerHistory({
    rawText: opts.rawText,
    targetRole: opts.targetRole,
    source: opts.source,
    fileName: opts.fileName,
    oauthIdentity: opts.oauthIdentity,
    measuredScores: opts.measuredScores ?? [],
  });
}

/**
 * Runs both PDF/file extraction (`pdfjs-dist`) and structured resume parsing in one call.
 */
export async function processResumeFile(
  file: File,
  opts: {
    targetRole: string;
    measuredScores?: MeasuredSkillScore[] | undefined;
  },
): Promise<{ document: ExtractedResumeDocument; parsed: CareerImportResult }> {
  const document = await extractResumeDocument(file);
  const parsed = parseResumeTextForRoadmap({
    rawText: document.rawText,
    targetRole: opts.targetRole,
    source: document.source,
    fileName: document.fileName,
    measuredScores: opts.measuredScores,
  });
  return { document, parsed };
}

/**
 * Builds a deterministic, persisted snapshot of prioritized skill gaps for `/roadmap`.
 */
export function buildSkillGapRoadmapSnapshot(opts: {
  targetRole: string;
  sourceLabel: string;
  roadmapGaps: PopulatedRoadmapGap[];
}): SkillGapRoadmapSnapshot {
  const missingSkills = opts.roadmapGaps.filter((g) => !g.inHistory).map((g) => g.skill);
  const verifiedSkills = opts.roadmapGaps.filter((g) => g.inHistory).map((g) => g.skill);
  return {
    targetRole: opts.targetRole,
    sourceLabel: opts.sourceLabel,
    updatedAt: new Date().toISOString(),
    totalGaps: missingSkills.length,
    missingSkills,
    verifiedSkills,
    items: opts.roadmapGaps,
  };
}

/**
 * Commits parsed (or user-confirmed) skills and work experience to workspace persistence
 * and triggers an update to the user's personalized skill-gap roadmap.
 */
export async function syncResumeToSkillGapRoadmap(opts: {
  draft: CareerImportResult;
  targetRole: string;
  confirmedFullName?: string | undefined;
  confirmedHeadline?: string | undefined;
  confirmedSkills?: string[] | undefined;
  confirmedRoles?: CareerRoleEntry[] | undefined;
  measuredScores?: MeasuredSkillScore[] | undefined;
  updateWorkspace: (patch: WorkspaceRoadmapPatch) => Promise<void>;
  onRoadmapUpdated?: ((snapshot: SkillGapRoadmapSnapshot) => void) | undefined;
}): Promise<SyncResumeResult> {
  const finalized = finalizeCareerImportDraft({
    draft: opts.draft,
    targetRole: opts.targetRole,
    confirmedFullName: opts.confirmedFullName ?? opts.draft.history.fullName,
    confirmedHeadline: opts.confirmedHeadline ?? opts.draft.history.headline,
    confirmedSkills: opts.confirmedSkills ?? opts.draft.history.extractedSkills,
    confirmedRoles: opts.confirmedRoles ?? opts.draft.history.roles,
    measuredScores: opts.measuredScores ?? [],
  });

  const snapshot = buildSkillGapRoadmapSnapshot({
    targetRole: opts.targetRole,
    sourceLabel: finalized.history.sourceLabel,
    roadmapGaps: finalized.roadmapGaps,
  });

  await opts.updateWorkspace({
    resume: finalized.rawText,
    extractedResume: finalized.resumeProfile,
    careerHistory: finalized.history,
    skillGapRoadmap: snapshot,
  });

  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent(ROADMAP_UPDATED_EVENT, { detail: snapshot }));
  }
  opts.onRoadmapUpdated?.(snapshot);

  return { finalized, snapshot };
}
