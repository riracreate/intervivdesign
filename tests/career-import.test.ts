import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCareerGapRoadmap,
  finalizeCareerImportDraft,
  importCareerHistory,
  parseCsvRows,
  SAMPLE_LINKEDIN_HISTORY_CSV,
} from "../src/lib/interviv/career-import";
import { reconstructPdfLines } from "../src/lib/interviv/pdf-parser";
import {
  extractResumeDocument,
  processResumeFile,
  syncResumeToSkillGapRoadmap,
  type SkillGapRoadmapSnapshot,
  type WorkspaceRoadmapPatch,
} from "../src/lib/interviv/resume-service";
import {
  buildLinkedInAuthUrl,
  buildLinkedInRedirectUri,
  isAllowedOAuthOrigin,
  renderLinkedInPopupHtml,
  resolveAppBaseUrl,
} from "../src/lib/interviv/linkedin-oauth";

test("parseCsvRows handles quoted fields containing commas and newlines", () => {
  const rows = parseCsvRows(
    `Company,Title,Description\n"Nimbus, Inc.",Senior Engineer,"Built React, TypeScript, and SQL pipelines"`,
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[1]?.[0], "Nimbus, Inc.");
  assert.equal(rows[1]?.[2], "Built React, TypeScript, and SQL pipelines");
});

test("importCareerHistory extracts dated roles and skills from LinkedIn CSV and populates gaps", () => {
  const result = importCareerHistory({
    rawText: SAMPLE_LINKEDIN_HISTORY_CSV,
    targetRole: "Software Engineer",
    source: "linkedin-csv",
    fileName: "Positions.csv",
  });

  assert.equal(result.history.sourceLabel, "LinkedIn CSV Export");
  assert.equal(result.history.roles.length, 2);
  assert.equal(result.history.roles[0]?.company, "Nimbus Commerce");
  assert.ok(result.history.yearsEstimated >= 3);
  assert.ok(result.history.extractedSkills.includes("React"));
  assert.ok(result.history.extractedSkills.includes("PostgreSQL"));
  // Target role skills missing in the CSV (e.g. DSA, OOP, Python) become top roadmap gaps
  const missing = result.roadmapGaps.filter((g) => !g.inHistory).map((g) => g.skill);
  assert.ok(missing.includes("DSA"));
  assert.ok(missing.includes("System design"));
  assert.equal(result.roadmapGaps[0]?.inHistory, false);
});

test("reconstructPdfLines preserves Y-grouped PDF lines and feeds PDF resume extraction", () => {
  const items = [
    { str: "Maya Kulkarni", transform: [1, 0, 0, 1, 40, 740], hasEOL: true },
    { str: "EXPERIENCE", transform: [1, 0, 0, 1, 40, 710], hasEOL: true },
    {
      str: "Senior Software Engineer — Nimbus Commerce (2023 – Present)",
      transform: [1, 0, 0, 1, 40, 690],
    },
    {
      str: "• Architected React and PostgreSQL APIs cutting p95 latency by 42%",
      transform: [1, 0, 0, 1, 48, 672],
    },
    { str: "SKILLS", transform: [1, 0, 0, 1, 40, 640] },
    { str: "TypeScript, React, PostgreSQL, Docker", transform: [1, 0, 0, 1, 40, 622] },
  ];

  const text = reconstructPdfLines(items);
  assert.ok(text.includes("Maya Kulkarni\nEXPERIENCE\n"));

  const parsed = importCareerHistory({
    rawText: text,
    targetRole: "Software Engineer",
    source: "file-upload",
    fileName: "maya-resume.pdf",
  });

  assert.equal(parsed.history.sourceLabel, "LinkedIn / Resume PDF");
  assert.equal(parsed.history.fullName, "Maya Kulkarni");
  assert.equal(parsed.history.roles.length, 1);
  assert.equal(parsed.history.roles[0]?.company, "Nimbus Commerce");
  assert.ok(parsed.history.extractedSkills.includes("TypeScript"));
  assert.ok(parsed.history.extractedSkills.includes("PostgreSQL"));
});

test("finalizeCareerImportDraft applies user-confirmed skill and role edits before roadmap sync", () => {
  const draft = importCareerHistory({
    rawText: SAMPLE_LINKEDIN_HISTORY_CSV,
    targetRole: "Software Engineer",
    source: "file-upload",
    fileName: "resume.pdf",
  });

  const confirmed = finalizeCareerImportDraft({
    draft,
    targetRole: "Software Engineer",
    confirmedFullName: "Riya Sharma",
    confirmedHeadline: "Staff Software Engineer",
    confirmedSkills: [...draft.history.extractedSkills, "DSA", "Python"],
    confirmedRoles: draft.history.roles.slice(0, 1),
  });

  assert.equal(confirmed.history.fullName, "Riya Sharma");
  assert.equal(confirmed.history.headline, "Staff Software Engineer");
  assert.equal(confirmed.history.roles.length, 1);
  assert.ok(confirmed.history.extractedSkills.includes("DSA"));
  assert.ok(confirmed.resumeProfile.jdMatch.matched.includes("DSA"));
  assert.ok(!confirmed.roadmapGaps.filter((g) => !g.inHistory).some((g) => g.skill === "DSA"));
});

test("importCareerHistory parses JSON career archive and overlays LinkedIn OAuth identity", () => {
  const jsonPayload = JSON.stringify({
    headline: "Staff Backend Engineer",
    positions: [
      {
        title: "Backend Engineer",
        company: "Cedar Systems",
        startedOn: "2020",
        finishedOn: "2024",
        description: "Scaled PostgreSQL, Redis caching, Docker, and System design services.",
      },
    ],
    education: ["B.Tech Computer Science"],
  });

  const result = importCareerHistory({
    rawText: jsonPayload,
    targetRole: "Backend Engineer",
    source: "linkedin-oauth",
    oauthIdentity: {
      fullName: "Aarav Mehta",
      email: "aarav@example.dev",
      location: "IN",
    },
  });

  assert.equal(result.history.fullName, "Aarav Mehta");
  assert.equal(result.history.email, "aarav@example.dev");
  assert.equal(result.history.roles.length, 1);
  assert.ok(result.history.extractedSkills.includes("PostgreSQL"));
  assert.ok(result.history.extractedSkills.includes("System design"));
});

test("buildCareerGapRoadmap ranks missing history skills ahead of untested verified skills", () => {
  const gaps = buildCareerGapRoadmap({
    targetRole: "Frontend Engineer",
    extractedSkills: ["React", "TypeScript", "JavaScript"],
    measuredScores: [{ skill: "React", score: 88, attempts: 3 }],
  });

  const topThree = gaps.slice(0, 3).map((g) => g.skill);
  assert.ok(!topThree.includes("React"));
  assert.ok(gaps[0]?.priorityScore > gaps[gaps.length - 1]!.priorityScore);
});

test("LinkedIn OAuth helpers construct APP_URL redirect URI, auth URL, origin guard, and popup script", () => {
  const base = resolveAppBaseUrl(
    "https://ais-dev-example.asia-southeast1.run.app/",
    "http://localhost:3000/api/linkedin/url",
  );
  assert.equal(base, "https://ais-dev-example.asia-southeast1.run.app");
  const redirect = buildLinkedInRedirectUri(base);
  assert.equal(redirect, "https://ais-dev-example.asia-southeast1.run.app/auth/linkedin/callback");

  const authUrl = buildLinkedInAuthUrl({
    clientId: "client-123",
    redirectUri: redirect,
    state: "state-xyz",
  });
  assert.ok(authUrl.startsWith("https://www.linkedin.com/oauth/v2/authorization?"));
  assert.ok(authUrl.includes("client_id=client-123"));
  assert.ok(authUrl.includes("state=state-xyz"));

  assert.equal(isAllowedOAuthOrigin("https://ais-dev-example.run.app"), true);
  assert.equal(isAllowedOAuthOrigin("http://localhost:3000"), true);
  assert.equal(isAllowedOAuthOrigin("https://evil.example.com"), false);

  const html = renderLinkedInPopupHtml({
    type: "LINKEDIN_OAUTH_SUCCESS",
    profile: { fullName: "Maya", email: "maya@example.dev", headline: "", location: "US" },
  });
  assert.ok(html.includes("LINKEDIN_OAUTH_SUCCESS"));
  assert.ok(html.includes("window.opener.postMessage"));
});

test("resume-service processes resume files, rejects empty inputs, and triggers skill-gap roadmap updates", async () => {
  const emptyFile = new File(["   "], "empty.txt", { type: "text/plain" });
  await assert.rejects(() => extractResumeDocument(emptyFile), /No readable text found/);

  const resumeText = [
    "Kabir Nair",
    "EXPERIENCE",
    "Senior Software Engineer — Orbit Stack (2022 – Present)",
    "• Built TypeScript, React, and PostgreSQL services.",
    "SKILLS",
    "TypeScript, React, PostgreSQL, Docker",
  ].join("\n");

  const resumeFile = new File([resumeText], "kabir-resume.txt", { type: "text/plain" });
  const { document, parsed } = await processResumeFile(resumeFile, {
    targetRole: "Software Engineer",
  });

  assert.equal(document.fileName, "kabir-resume.txt");
  assert.equal(parsed.history.fullName, "Kabir Nair");
  assert.equal(parsed.history.roles.length, 1);
  assert.ok(parsed.history.extractedSkills.includes("PostgreSQL"));

  let persisted: WorkspaceRoadmapPatch | null = null;
  let notified: SkillGapRoadmapSnapshot | null = null;

  const { snapshot } = await syncResumeToSkillGapRoadmap({
    draft: parsed,
    targetRole: "Software Engineer",
    confirmedSkills: [...parsed.history.extractedSkills, "Python"],
    updateWorkspace: async (patch) => {
      persisted = patch;
    },
    onRoadmapUpdated: (snap) => {
      notified = snap;
    },
  });

  assert.ok(persisted !== null);
  assert.ok(notified !== null);
  assert.equal(snapshot.targetRole, "Software Engineer");
  assert.ok(snapshot.missingSkills.includes("DSA"));
  assert.ok(!snapshot.missingSkills.includes("Python"));
  assert.equal((persisted as WorkspaceRoadmapPatch).skillGapRoadmap.totalGaps, snapshot.totalGaps);
});
