import test from "node:test";
import assert from "node:assert/strict";
import {
  extractResumeProfile,
  SAMPLE_JD_TEXT,
  SAMPLE_RESUME_TEXT,
} from "../src/lib/interviv/resume-extractor";
import {
  codingChallenges,
  gradeSqlRows,
  runJavaScriptChallenge,
} from "../src/lib/interviv/code-runner";
import {
  extendedQuestions,
  formatRelativeReview,
  partitionReviews,
  scheduleReviewItem,
} from "../src/lib/interviv/spaced-repetition";

import {
  HOW_IT_WORKS_STEPS,
  LANDING_MODES,
  buildEnergyMeter,
  computeGaugeMetrics,
  dueTopicPriority,
  interpolateCount,
  resolveTheme,
  sliceTypedText,
  toggleResolvedTheme,
} from "../src/lib/interviv/landing-and-theme";

test("resume extractor parses contact, categorized skills, education, and bullet audits", () => {
  const result = extractResumeProfile(SAMPLE_RESUME_TEXT, "Software Engineer", SAMPLE_JD_TEXT);

  assert.equal(result.contact.name, "Maya Kulkarni");
  assert.equal(result.contact.email, "maya.kulkarni@example.dev");
  assert.ok(result.contact.phone.includes("415"));
  assert.ok(result.contact.links.some((l) => l.includes("github.com/mayakulkarni")));
  assert.ok(result.contact.links.some((l) => l.includes("linkedin.com/in/mayakulkarni")));

  assert.ok(result.sectionsFound.includes("experience"));
  assert.ok(result.sectionsFound.includes("education"));
  assert.ok(result.sectionsFound.includes("skills"));
  assert.ok(result.sectionsFound.includes("projects"));

  assert.ok(result.allSkills.includes("TypeScript"));
  assert.ok(result.allSkills.includes("PostgreSQL"));
  assert.ok(result.allSkills.includes("System design"));
  assert.ok(result.education.some((e) => e.includes("B.Tech")));
  assert.ok(result.certifications.some((c) => c.includes("AWS Certified")));

  assert.ok(result.bulletStats.total >= 5);
  assert.ok(result.bulletStats.withMetrics >= 3);
  assert.ok(result.bulletStats.needsWork >= 1);
  assert.ok(
    result.experience.some((group) =>
      group.bullets.some((b) =>
        b.issues.some((i) => i.includes("Responsible for") || i.includes("passive")),
      ),
    ),
  );

  assert.equal(result.jdMatch.missing.length, 0);
  assert.equal(result.jdMatch.matchPct, 100);
  assert.ok(result.score.overall >= 70);
});

test("resume extractor identifies missing target skills and avoids false positives on short tokens", () => {
  const sparse = "Alex Rivera\nalex@example.com\nBuilt HTML marketing pages for a small blog.";
  const result = extractResumeProfile(sparse, "Backend Engineer");

  assert.equal(result.contact.name, "Alex Rivera");
  assert.ok(result.jdMatch.missing.includes("PostgreSQL"));
  assert.ok(result.jdMatch.missing.includes("Redis"));
  assert.ok(!result.allSkills.includes("Go"));
  assert.ok(result.score.overall < 50);
});

test("code runner passes reference solutions for all function and class challenges", () => {
  for (const challenge of codingChallenges) {
    const execution = runJavaScriptChallenge(challenge, challenge.solution);
    assert.equal(execution.compileError, undefined, `${challenge.id} compileError`);
    assert.equal(execution.ok, true, `${challenge.id} failed tests`);
    assert.equal(execution.passedCount, challenge.tests.length);
  }
});

test("code runner catches wrong output, console logs, and syntax errors cleanly", () => {
  const twoSum = codingChallenges.find((c) => c.id === "two-sum");
  assert.ok(twoSum);

  const wrong = runJavaScriptChallenge(
    twoSum,
    `function twoSum(nums, target) { console.log("checking", target); return [0, 0]; }`,
  );
  assert.equal(wrong.ok, false);
  assert.equal(wrong.passedCount, 0);
  assert.ok(wrong.logs.some((l) => l.includes("checking 9")));

  const broken = runJavaScriptChallenge(twoSum, "function twoSum( {");
  assert.equal(broken.ok, false);
  assert.ok(Boolean(broken.compileError));
});

test("SQL grader compares row sets independent of column order and catches mismatches", () => {
  const pass = gradeSqlRows(
    [
      { salary: 95000, name: "Ada" },
      { salary: 112000, name: "Noor" },
    ],
    [
      { name: "Noor", salary: 112000 },
      { name: "Ada", salary: 95000 },
    ],
    false,
  );
  assert.equal(pass.passed, true);

  const failCount = gradeSqlRows(
    [{ name: "Ada", salary: 95000 }],
    [
      { name: "Ada", salary: 95000 },
      { name: "Noor", salary: 112000 },
    ],
  );
  assert.equal(failCount.passed, false);
  assert.ok(failCount.feedback.includes("Expected 2 row(s)"));
});

test("spaced repetition scheduler advances stages on pass, resets on miss, and partitions due items", () => {
  const baseTime = Date.UTC(2026, 5, 1, 12, 0, 0);
  const q = extendedQuestions[0];
  assert.ok(q);

  const firstPass = scheduleReviewItem(undefined, q, 85, baseTime);
  assert.equal(firstPass.stage, 1);
  assert.equal(firstPass.attempts, 1);
  assert.equal(formatRelativeReview(firstPass.nextReviewAt, baseTime), "Due in 3 days");

  const secondPass = scheduleReviewItem(firstPass, q, 90, baseTime);
  assert.equal(secondPass.stage, 2);
  assert.equal(formatRelativeReview(secondPass.nextReviewAt, baseTime), "Due in 7 days");

  const missed = scheduleReviewItem(secondPass, q, 40, baseTime);
  assert.equal(missed.stage, 0);
  assert.equal(formatRelativeReview(missed.nextReviewAt, baseTime), "Due in 1 day");

  const dueNow: typeof firstPass = {
    ...firstPass,
    nextReviewAt: new Date(baseTime - 60_000).toISOString(),
  };
  const { due, upcoming } = partitionReviews([dueNow, secondPass], baseTime);
  assert.equal(due.length, 1);
  assert.equal(upcoming.length, 1);
});

test("theme resolver defaults to dark, honors light toggle override, and toggles cleanly", () => {
  assert.equal(resolveTheme(null), "dark");
  assert.equal(resolveTheme(undefined), "dark");
  assert.equal(resolveTheme("system"), "dark");
  assert.equal(resolveTheme("light"), "light");
  assert.equal(resolveTheme("dark"), "dark");
  assert.equal(toggleResolvedTheme("light"), "dark");
  assert.equal(toggleResolvedTheme("dark"), "light");
});

test("count-up, gauge geometry, spaced-repetition priority, typing slice, energy meter, and mode catalog", () => {
  assert.equal(interpolateCount(100, 0), 0);
  assert.equal(interpolateCount(100, 1), 100);
  assert.ok(interpolateCount(100, 0.5) > 50);

  const fullGauge = computeGaugeMetrics(100, 64);
  assert.equal(Math.round(fullGauge.dashOffset), 0);
  const halfGauge = computeGaugeMetrics(50, 64);
  assert.ok(Math.abs(halfGauge.dashOffset - halfGauge.circumference / 2) < 0.01);
  assert.equal(computeGaugeMetrics(null, 64).clampedScore, 0);

  const now = new Date(2026, 5, 10, 14, 0, 0).getTime();
  assert.equal(
    dueTopicPriority(new Date(2026, 5, 9, 10, 0, 0).toISOString(), now).level,
    "overdue",
  );
  assert.equal(
    dueTopicPriority(new Date(2026, 5, 10, 18, 0, 0).toISOString(), now).level,
    "due-today",
  );
  assert.equal(
    dueTopicPriority(new Date(2026, 5, 13, 12, 0, 0).toISOString(), now).level,
    "upcoming",
  );

  assert.equal(sliceTypedText("hello world", 5), "hello");
  assert.equal(sliceTypedText("hello", 99), "hello");
  assert.ok(
    buildEnergyMeter({ transcript: "Index B+ tree", listening: true, speaking: false }) > 50,
  );

  assert.deepEqual(
    LANDING_MODES.map((m) => m.id),
    ["voice", "camera", "avatar", "coding", "resume"],
  );
  assert.equal(HOW_IT_WORKS_STEPS.length, 3);
});
