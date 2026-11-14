import {
  extractResumeProfile,
  getRoleTargetSkills,
  type ExtractedResume,
} from "./resume-extractor";
import { gapSeverity } from "./data";

export type CareerImportSource = "linkedin-oauth" | "linkedin-csv" | "file-upload" | "pasted-text";

export type CareerRoleEntry = {
  title: string;
  company: string;
  period: string;
  highlights: string[];
  skills: string[];
};

export type CareerHistoryProfile = {
  source: CareerImportSource;
  sourceLabel: string;
  fileName?: string | undefined;
  fullName: string;
  headline: string;
  email: string;
  location: string;
  yearsEstimated: number;
  roles: CareerRoleEntry[];
  education: string[];
  extractedSkills: string[];
  importedAt: string;
};

export type PopulatedRoadmapGap = {
  skill: string;
  inHistory: boolean;
  observedScore: number | null;
  targetBenchmark: number;
  severity: string;
  priorityScore: number;
  recommendedAction: string;
};

export type CareerImportResult = {
  history: CareerHistoryProfile;
  resumeProfile: ExtractedResume;
  rawText: string;
  roadmapGaps: PopulatedRoadmapGap[];
};

const ROLE_BENCHMARKS: Record<string, number> = {
  DSA: 85,
  DBMS: 80,
  OOP: 75,
  "System design": 80,
  Python: 75,
  Behavioral: 70,
  SQL: 80,
  React: 75,
  TypeScript: 75,
  JavaScript: 75,
  "Node.js": 75,
  PostgreSQL: 75,
  Docker: 70,
  AWS: 70,
  Kubernetes: 70,
  Accessibility: 75,
  Testing: 75,
  "Machine Learning": 75,
  "AI & LLMs": 75,
  "Data Engineering": 75,
  Redis: 70,
  "CI/CD": 70,
};

/** Parse RFC-4180 CSV into rows of cells (handles quoted commas, newlines, escaped quotes). */
export function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const text = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

function estimateYearsFromPeriods(periods: string[]): number {
  const years: number[] = [];
  let hasPresent = false;
  for (const p of periods) {
    if (/present|current|now/i.test(p)) hasPresent = true;
    const matches = p.match(/\b(19\d{2}|20\d{2})\b/g);
    if (matches) {
      for (const m of matches) years.push(Number(m));
    }
  }
  if (!years.length) return 0;
  const minYear = Math.min(...years);
  const maxYear = hasPresent ? new Date().getFullYear() : Math.max(...years);
  return Math.max(1, maxYear - minYear);
}

function detectSkillsInChunk(text: string, targetRole: string): string[] {
  return extractResumeProfile(text, targetRole).allSkills;
}

function tryParseLinkedInCsv(
  rawText: string,
  targetRole: string,
): {
  roles: CareerRoleEntry[];
  extraSkills: string[];
  fullName: string;
  headline: string;
  location: string;
  rawSummaryText: string;
} | null {
  const rows = parseCsvRows(rawText);
  if (rows.length < 2) return null;
  const headers = rows[0]!.map((h) => h.toLowerCase());
  const idx = (names: string[]) => headers.findIndex((h) => names.some((n) => h.includes(n)));

  const titleCol = idx(["title", "position", "role"]);
  const companyCol = idx(["company", "organization", "employer"]);
  const descCol = idx(["description", "summary", "responsibilities"]);
  const startCol = idx(["started", "start", "from"]);
  const endCol = idx(["finished", "end", "to"]);
  const locCol = idx(["location", "city"]);
  const nameCol = idx(["first name", "full name", "name"]);
  const skillCol = idx(["skill"]);

  // Single-column LinkedIn Skills.csv export
  if (titleCol === -1 && skillCol !== -1) {
    const skillsList = rows
      .slice(1)
      .map((r) => r[skillCol] ?? "")
      .filter(Boolean);
    if (!skillsList.length) return null;
    const joined = `SKILLS\n${skillsList.join(", ")}`;
    return {
      roles: [],
      extraSkills: extractResumeProfile(joined, targetRole).allSkills,
      fullName: "",
      headline: "",
      location: "",
      rawSummaryText: joined,
    };
  }

  if (titleCol === -1 && companyCol === -1) return null;

  const roles: CareerRoleEntry[] = [];
  const textChunks: string[] = [];
  let location = "";
  let fullName = "";

  for (const r of rows.slice(1)) {
    const title = (titleCol >= 0 ? r[titleCol] : "") || "Role";
    const company = (companyCol >= 0 ? r[companyCol] : "") || "Organization";
    const start = startCol >= 0 ? (r[startCol] ?? "") : "";
    const end = endCol >= 0 ? (r[endCol] ?? "") : "";
    const period = [start, end || (start ? "Present" : "")].filter(Boolean).join(" – ");
    const desc = descCol >= 0 ? (r[descCol] ?? "") : "";
    if (!location && locCol >= 0 && r[locCol]) location = r[locCol]!;
    if (!fullName && nameCol >= 0 && r[nameCol]) fullName = r[nameCol]!;

    const highlights = desc
      .split(/\n+|;\s+|\.\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10)
      .slice(0, 4);

    const combined = `${title} ${company} ${desc}`;
    roles.push({
      title,
      company,
      period: period || "Timeline not specified",
      highlights,
      skills: detectSkillsInChunk(combined, targetRole),
    });

    textChunks.push(
      `${title} — ${company}${period ? ` (${period})` : ""}`,
      ...highlights.map((h) => `• ${h}`),
    );
  }

  if (!roles.length) return null;
  const rawSummaryText = [fullName || "LinkedIn Export Profile", "EXPERIENCE", ...textChunks].join(
    "\n",
  );

  return {
    roles,
    extraSkills: extractResumeProfile(rawSummaryText, targetRole).allSkills,
    fullName,
    headline: roles[0] ? `${roles[0].title} at ${roles[0].company}` : "",
    location,
    rawSummaryText,
  };
}

function tryParseJsonCareerHistory(
  rawText: string,
  targetRole: string,
): {
  roles: CareerRoleEntry[];
  fullName: string;
  headline: string;
  email: string;
  location: string;
  education: string[];
  rawSummaryText: string;
} | null {
  const trimmed = rawText.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown> | unknown[];
    const obj = Array.isArray(parsed) ? ({ positions: parsed } as Record<string, unknown>) : parsed;

    const fullName =
      typeof obj["name"] === "string"
        ? obj["name"]
        : typeof obj["fullName"] === "string"
          ? obj["fullName"]
          : typeof obj["firstName"] === "string"
            ? `${obj["firstName"]} ${typeof obj["lastName"] === "string" ? obj["lastName"] : ""}`.trim()
            : "";

    const headline = typeof obj["headline"] === "string" ? obj["headline"] : "";
    const email = typeof obj["email"] === "string" ? obj["email"] : "";
    const location = typeof obj["location"] === "string" ? obj["location"] : "";

    const rawRoles = (
      Array.isArray(obj["positions"])
        ? obj["positions"]
        : Array.isArray(obj["experience"])
          ? obj["experience"]
          : Array.isArray(obj["roles"])
            ? obj["roles"]
            : []
    ) as Record<string, unknown>[];

    const roles: CareerRoleEntry[] = rawRoles
      .map((item) => {
        const title = String(item["title"] ?? item["role"] ?? "Engineer");
        const company = String(item["company"] ?? item["companyName"] ?? "Organization");
        const period = String(
          item["period"] ??
            ([item["startedOn"] ?? item["startDate"], item["finishedOn"] ?? item["endDate"]]
              .filter(Boolean)
              .join(" – ") ||
              "Timeline not specified"),
        );
        const rawHighlights = Array.isArray(item["highlights"])
          ? item["highlights"].map(String)
          : typeof item["description"] === "string"
            ? item["description"]
                .split(/\n+|\.\s+/)
                .map((s) => s.trim())
                .filter((s) => s.length > 8)
            : [];
        const skills = detectSkillsInChunk(
          `${title} ${company} ${rawHighlights.join(" ")}`,
          targetRole,
        );
        return { title, company, period, highlights: rawHighlights.slice(0, 4), skills };
      })
      .filter((r) => r.title || r.company);

    const declaredSkills = Array.isArray(obj["skills"]) ? obj["skills"].map(String) : [];
    const education = Array.isArray(obj["education"])
      ? obj["education"].map((e) => (typeof e === "string" ? e : JSON.stringify(e)))
      : [];

    const textLines = [
      fullName || "Imported Career Profile",
      headline,
      email,
      declaredSkills.length ? `SKILLS\n${declaredSkills.join(", ")}` : "",
      roles.length ? "EXPERIENCE" : "",
      ...roles.flatMap((r) => [
        `${r.title} — ${r.company} (${r.period})`,
        ...r.highlights.map((h) => `• ${h}`),
      ]),
      education.length ? `EDUCATION\n${education.join("\n")}` : "",
    ].filter(Boolean);

    return {
      roles,
      fullName,
      headline,
      email,
      location,
      education,
      rawSummaryText: textLines.join("\n"),
    };
  } catch {
    return null;
  }
}

export function buildCareerGapRoadmap(opts: {
  targetRole: string;
  extractedSkills: string[];
  measuredScores: Array<{ skill: string; score: number; attempts: number }>;
}): PopulatedRoadmapGap[] {
  const roleTargets = getRoleTargetSkills(opts.targetRole);
  const historySet = new Set(opts.extractedSkills.map((s) => s.toLowerCase()));
  const allTargets = Array.from(
    new Set([...roleTargets, "DSA", "DBMS", "System design", "Behavioral"]),
  );

  return allTargets
    .map((skill) => {
      const inHistory = historySet.has(skill.toLowerCase());
      const measured = opts.measuredScores.find(
        (m) => m.skill.toLowerCase() === skill.toLowerCase(),
      );
      const targetBenchmark = ROLE_BENCHMARKS[skill] ?? 75;
      const gap = targetBenchmark - (measured?.score ?? 0);
      const severity = gapSeverity(gap, measured?.attempts ?? 0);

      // Missing from extracted LinkedIn/upload history jumps priority so the roadmap closes
      // missing background proof alongside weak unassisted practice areas.
      const priorityScore =
        (!inHistory ? 350 : 0) +
        (severity === "High"
          ? 400 + gap
          : severity === "Medium"
            ? 300 + gap
            : severity === "Untested"
              ? 200
              : 100 + gap);

      const recommendedAction = !inHistory
        ? `Missing in career history for ${opts.targetRole} — add focused ${skill} study + baseline round.`
        : measured
          ? `${measured.score}% measured vs ${targetBenchmark}% target — close remaining ${skill} gap.`
          : `Present in your profile — verify with an unassisted ${skill} practice round.`;

      return {
        skill,
        inHistory,
        observedScore: measured?.score ?? null,
        targetBenchmark,
        severity,
        priorityScore,
        recommendedAction,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Normalizes LinkedIn CSV exports, LinkedIn JSON, LinkedIn PDF/resume text, or OAuth identity
 * into a structured CareerHistoryProfile + ExtractedResume + ranked skill-gap roadmap.
 */
export function importCareerHistory(opts: {
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
  measuredScores?: Array<{ skill: string; score: number; attempts: number }>;
}): CareerImportResult {
  const { rawText, targetRole, source, fileName, oauthIdentity, measuredScores = [] } = opts;

  const csvParsed =
    fileName?.toLowerCase().endsWith(".csv") || rawText.trim().split("\n")[0]?.includes(",")
      ? tryParseLinkedInCsv(rawText, targetRole)
      : null;

  const jsonParsed =
    !csvParsed &&
    (fileName?.toLowerCase().endsWith(".json") ||
      rawText.trim().startsWith("{") ||
      rawText.trim().startsWith("["))
      ? tryParseJsonCareerHistory(rawText, targetRole)
      : null;

  const normalizedText = csvParsed?.rawSummaryText ?? jsonParsed?.rawSummaryText ?? rawText.trim();
  const resumeProfile = extractResumeProfile(normalizedText, targetRole);

  let roles: CareerRoleEntry[] = csvParsed?.roles ?? jsonParsed?.roles ?? [];
  if (!roles.length && resumeProfile.experience.length > 0) {
    roles = resumeProfile.experience
      .filter((exp) => exp.header !== "Detected Statements")
      .map((exp) => {
        const parts = exp.header.split(/\s+(?:[—\-|@]|\bat\b)\s+/i);
        const title = (parts[0] ?? exp.header).replace(/\([^)]*\)/g, "").trim();
        const rest = parts.slice(1).join(" · ");
        const periodMatch = exp.header.match(/\(([^)]+)\)/);
        const company = rest.replace(/\([^)]*\)/g, "").trim() || "Career Experience";
        return {
          title: title || "Software Engineer",
          company,
          period: periodMatch?.[1] ?? "Experience",
          highlights: exp.bullets.map((b) => b.text).slice(0, 4),
          skills: detectSkillsInChunk(
            `${exp.header} ${exp.bullets.map((b) => b.text).join(" ")}`,
            targetRole,
          ),
        };
      });
  }

  const fullName =
    oauthIdentity?.fullName?.trim() ||
    csvParsed?.fullName ||
    jsonParsed?.fullName ||
    (resumeProfile.contact.name !== "Candidate Profile"
      ? resumeProfile.contact.name
      : "Candidate Profile");

  const headline =
    oauthIdentity?.headline?.trim() ||
    csvParsed?.headline ||
    jsonParsed?.headline ||
    (roles[0]
      ? `${roles[0].title}${roles[0].company ? ` · ${roles[0].company}` : ""}`
      : targetRole);

  const email = oauthIdentity?.email?.trim() || jsonParsed?.email || resumeProfile.contact.email;
  const location =
    oauthIdentity?.location?.trim() || csvParsed?.location || jsonParsed?.location || "";
  const education = jsonParsed?.education.length ? jsonParsed.education : resumeProfile.education;
  const extractedSkills = Array.from(
    new Set([...resumeProfile.allSkills, ...(csvParsed?.extraSkills ?? [])]),
  );

  const yearsEstimated = estimateYearsFromPeriods(roles.map((r) => r.period));

  const sourceLabel =
    source === "linkedin-oauth"
      ? "LinkedIn OAuth"
      : source === "linkedin-csv"
        ? "LinkedIn CSV Export"
        : source === "file-upload"
          ? fileName?.toLowerCase().endsWith(".pdf")
            ? "LinkedIn / Resume PDF"
            : "Uploaded History File"
          : "Pasted Career History";

  const history: CareerHistoryProfile = {
    source,
    sourceLabel,
    fileName,
    fullName,
    headline,
    email,
    location,
    yearsEstimated,
    roles,
    education,
    extractedSkills,
    importedAt: new Date().toISOString(),
  };

  const roadmapGaps = buildCareerGapRoadmap({
    targetRole,
    extractedSkills,
    measuredScores,
  });

  return {
    history,
    resumeProfile,
    rawText: normalizedText,
    roadmapGaps,
  };
}

/**
 * Applies user edits from the dashboard confirmation step (skills, work experience roles, name/headline)
 * and recomputes the gap-prioritized roadmap before persisting to workspace state.
 */
export function finalizeCareerImportDraft(opts: {
  draft: CareerImportResult;
  targetRole: string;
  confirmedFullName: string;
  confirmedHeadline: string;
  confirmedSkills: string[];
  confirmedRoles: CareerRoleEntry[];
  measuredScores?: Array<{ skill: string; score: number; attempts: number }>;
}): CareerImportResult {
  const {
    draft,
    targetRole,
    confirmedFullName,
    confirmedHeadline,
    confirmedSkills,
    confirmedRoles,
    measuredScores = [],
  } = opts;

  const dedupedSkills = Array.from(new Set(confirmedSkills.map((s) => s.trim()).filter(Boolean)));
  const roleTargets = getRoleTargetSkills(targetRole);
  const lowerConfirmed = new Set(dedupedSkills.map((s) => s.toLowerCase()));
  const matched = roleTargets.filter((s) => lowerConfirmed.has(s.toLowerCase()));
  const missing = roleTargets.filter((s) => !lowerConfirmed.has(s.toLowerCase()));
  const matchPct = roleTargets.length ? Math.round((matched.length / roleTargets.length) * 100) : 0;

  const yearsEstimated = estimateYearsFromPeriods(confirmedRoles.map((r) => r.period));

  const history: CareerHistoryProfile = {
    ...draft.history,
    fullName: confirmedFullName.trim() || draft.history.fullName,
    headline: confirmedHeadline.trim() || draft.history.headline,
    roles: confirmedRoles,
    extractedSkills: dedupedSkills,
    yearsEstimated,
    importedAt: new Date().toISOString(),
  };

  const resumeProfile: ExtractedResume = {
    ...draft.resumeProfile,
    contact: {
      ...draft.resumeProfile.contact,
      name: history.fullName,
    },
    allSkills: dedupedSkills,
    jdMatch: {
      ...draft.resumeProfile.jdMatch,
      targetSkills: roleTargets,
      matched,
      missing,
      matchPct,
    },
  };

  const roadmapGaps = buildCareerGapRoadmap({
    targetRole,
    extractedSkills: dedupedSkills,
    measuredScores,
  });

  return {
    history,
    resumeProfile,
    rawText: draft.rawText,
    roadmapGaps,
  };
}

export const SAMPLE_LINKEDIN_HISTORY_CSV = `Company Name,Title,Description,Location,Started On,Finished On
Nimbus Commerce,Senior Software Engineer,"Architected React and TypeScript search interfaces; built PostgreSQL transactional checkouts and Redis caching reducing p95 latency by 42%; mentored 3 engineers in CI/CD and Docker.",Bengaluru,Jan 2023,Present
Cedar Labs,Software Engineer,"Developed REST APIs in Node.js and Express; automated accessibility and regression testing covering 85+ UI flows; tuned SQL queries.",Hyderabad,Jun 2020,Dec 2022`;
