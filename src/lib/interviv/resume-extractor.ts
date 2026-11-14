export type SkillCategory =
  | "Languages"
  | "Frontend"
  | "Backend & Databases"
  | "System & Cloud"
  | "CS Fundamentals"
  | "AI & Data";

export type ExtractedSkillGroup = {
  category: SkillCategory;
  skills: string[];
};

export type BulletAudit = {
  text: string;
  hasActionVerb: boolean;
  hasMetric: boolean;
  issues: string[];
  suggestion: string;
};

export type ExtractedExperience = {
  header: string;
  bullets: BulletAudit[];
};

export type ExtractedResume = {
  contact: {
    name: string;
    email: string;
    phone: string;
    links: string[];
  };
  sectionsFound: string[];
  missingSections: string[];
  skillGroups: ExtractedSkillGroup[];
  allSkills: string[];
  education: string[];
  certifications: string[];
  experience: ExtractedExperience[];
  bulletStats: {
    total: number;
    withMetrics: number;
    withActionVerbs: number;
    needsWork: number;
  };
  jdMatch: {
    targetSkills: string[];
    matched: string[];
    missing: string[];
    matchPct: number;
  };
  score: {
    overall: number;
    keywordAlignment: number;
    sectionCompleteness: number;
    impactEvidence: number;
  };
  wordCount: number;
  extractedAt: string;
};

const SKILL_TAXONOMY: Record<SkillCategory, string[]> = {
  Languages: ["TypeScript", "JavaScript", "Python", "Java", "C++", "Go", "Rust", "SQL"],
  Frontend: ["React", "Next.js", "HTML", "CSS", "Tailwind", "Redux", "Accessibility", "Frontend"],
  "Backend & Databases": [
    "Node.js",
    "Express",
    "PostgreSQL",
    "MongoDB",
    "Redis",
    "REST",
    "GraphQL",
    "DBMS",
    "Backend",
  ],
  "System & Cloud": [
    "System design",
    "Docker",
    "Kubernetes",
    "AWS",
    "GCP",
    "CI/CD",
    "Linux",
    "DevOps & Cloud",
    "Microservices",
  ],
  "CS Fundamentals": [
    "DSA",
    "OOP",
    "Operating Systems",
    "Computer Networks",
    "Security",
    "Testing",
  ],
  "AI & Data": [
    "Machine Learning",
    "AI & LLMs",
    "Data Engineering",
    "PyTorch",
    "TensorFlow",
    "Pandas",
    "Spark",
  ],
};

const SKILL_ALIASES: Record<string, string[]> = {
  DSA: ["dsa", "data structures", "algorithms", "leetcode"],
  DBMS: ["dbms", "database management", "relational database", "indexing", "acid"],
  OOP: ["oop", "object-oriented", "object oriented"],
  "System design": ["system design", "distributed systems", "scalability", "load balancer"],
  "DevOps & Cloud": ["devops", "cloud", "terraform", "ci/cd"],
  "Operating Systems": ["operating systems", "concurrency", "multithreading", "posix"],
  "Computer Networks": ["computer networks", "tcp/ip", "http", "dns"],
  "AI & LLMs": ["llm", "large language model", "generative ai", "rag", "prompt engineering"],
  "Machine Learning": ["machine learning", "scikit-learn", "xgboost", "regression"],
  "Data Engineering": ["data engineering", "etl", "airflow", "kafka", "data pipeline"],
  "C++": ["c++"],
};

const STRONG_ACTION_VERBS = new Set([
  "architected",
  "automated",
  "built",
  "consolidated",
  "created",
  "decreased",
  "delivered",
  "designed",
  "developed",
  "engineered",
  "established",
  "expanded",
  "improved",
  "implemented",
  "increased",
  "launched",
  "led",
  "migrated",
  "optimized",
  "orchestrated",
  "reduced",
  "refactored",
  "resolved",
  "scaled",
  "shipped",
  "simplified",
  "spearheaded",
  "streamlined",
  "tested",
]);

const WEAK_PHRASINGS = [
  "responsible for",
  "worked on",
  "helped with",
  "assisted in",
  "tasked with",
  "duties included",
];

const STANDARD_SECTIONS = [
  { key: "summary", aliases: ["summary", "profile", "objective", "about"] },
  { key: "experience", aliases: ["experience", "employment", "work history", "career"] },
  { key: "projects", aliases: ["projects", "selected projects", "key projects"] },
  { key: "skills", aliases: ["skills", "technical skills", "core competencies", "stack"] },
  { key: "education", aliases: ["education", "academic", "university", "degree"] },
  { key: "certifications", aliases: ["certifications", "certificates", "awards", "licenses"] },
];

const METRIC_REGEX =
  /(\d[\d,.]*\s*(%|\+|x\b|ms|sec|s\b|k\b|m\b|users|req|rps|hours|days|mins|flows|tests|endpoints|services|clients|queries|rows|records|gb|mb|tb)|(\$\s?\d[\d,.]*))/i;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsSkillTerm(lowerText: string, term: string) {
  const aliases = SKILL_ALIASES[term] ?? [term.toLowerCase()];
  return aliases.some((alias) => {
    if (alias === "c++") {
      return /(^|[^a-z0-9])c\+\+([^a-z0-9]|$)/i.test(lowerText);
    }
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(alias)}([^a-z0-9]|$)`, "i");
    return pattern.test(lowerText);
  });
}

function auditBullet(rawLine: string): BulletAudit {
  const cleaned = rawLine.replace(/^[\s•\-*–—]+/, "").trim();
  const lower = cleaned.toLowerCase();
  const firstWord = (lower.split(/\s+/)[0] ?? "").replace(/[^a-z]/g, "");
  const hasActionVerb = STRONG_ACTION_VERBS.has(firstWord);
  const hasMetric = METRIC_REGEX.test(cleaned);
  const weakPhrase = WEAK_PHRASINGS.find((p) => lower.includes(p));
  const issues: string[] = [];

  if (weakPhrase) {
    issues.push(`Replace passive phrase "${weakPhrase}" with a direct ownership verb.`);
  } else if (!hasActionVerb) {
    issues.push("Start with a specific action verb (e.g., Built, Reduced, Optimized).");
  }
  if (!hasMetric) {
    issues.push("Add a concrete outcome or scale metric (%, ms, users, or latency) if factual.");
  }
  if (cleaned.length < 40) {
    issues.push("Expand with the technical method or system context.");
  }

  const suggestion =
    issues.length === 0
      ? "Strong bullet: clear ownership verb and measurable outcome."
      : !hasActionVerb && !hasMetric
        ? "Rewrite as: [Action verb] + [system/feature built] + [measured improvement or scale]."
        : !hasMetric
          ? "Keep the action verb, and close with the measurable result (latency, throughput, or reliability)."
          : "Swap the opening phrase for a strong ownership verb like Engineered, Reduced, or Shipped.";

  return {
    text: cleaned,
    hasActionVerb,
    hasMetric,
    issues,
    suggestion,
  };
}

export function extractResumeProfile(
  rawText: string,
  role = "Software Engineer",
  jobDescription = "",
): ExtractedResume {
  const normalized = rawText.replace(/\r\n/g, "\n").trim();
  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const lower = normalized.toLowerCase();

  // Contact info
  const emailMatch = normalized.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = normalized.match(
    /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/,
  );
  const linkMatches = Array.from(
    new Set(
      normalized.match(
        /(?:https?:\/\/)?(?:www\.)?(?:github\.com|linkedin\.com|[\w-]+\.(?:dev|io|app|me))\/[\w./?=&%-]*/gi,
      ) ?? [],
    ),
  );

  const firstCandidate = lines[0] ?? "";
  const name =
    firstCandidate &&
    !firstCandidate.includes("@") &&
    firstCandidate.split(/\s+/).length <= 5 &&
    !/^(resume|curriculum vitae|summary|experience|skills|education)/i.test(firstCandidate)
      ? firstCandidate
      : "Candidate Profile";

  // Section detection
  const sectionsFound: string[] = [];
  const missingSections: string[] = [];
  for (const sec of STANDARD_SECTIONS) {
    const found = sec.aliases.some((alias) => {
      const rx = new RegExp(`(^|\\n)\\s*${escapeRegex(alias)}\\b`, "i");
      return rx.test(normalized) || lower.includes(alias);
    });
    if (found) sectionsFound.push(sec.key);
    else missingSections.push(sec.key);
  }

  // Categorized skills
  const skillGroups: ExtractedSkillGroup[] = [];
  const allSkillsSet = new Set<string>();
  for (const [category, list] of Object.entries(SKILL_TAXONOMY) as [SkillCategory, string[]][]) {
    const matched = list.filter((s) => containsSkillTerm(lower, s));
    if (matched.length > 0) {
      skillGroups.push({ category, skills: matched });
      for (const s of matched) allSkillsSet.add(s);
    }
  }
  const allSkills = Array.from(allSkillsSet);

  // Education & Certifications lines
  const education = lines.filter((line) =>
    /\b(b\.?tech|b\.?s\.?|b\.?e\.?|m\.?s\.?|m\.?tech|bachelor|master|ph\.?d|university|institute of technology|college|gpa|cgpa)\b/i.test(
      line,
    ),
  );
  const certifications = lines.filter((line) =>
    /\b(aws certified|google cloud|azure|cka|ckad|oracle certified|coursera|certificate|certification)\b/i.test(
      line,
    ),
  );

  // Experience & bullets extraction
  const experience: ExtractedExperience[] = [];
  let currentGroup: ExtractedExperience = {
    header: "Experience & Project Highlights",
    bullets: [],
  };
  for (const line of lines) {
    const isBullet = /^([•\-*–—]|\d+\.)\s+/.test(line);
    const looksLikeRoleHeader =
      !isBullet &&
      (/\b(20\d{2}|19\d{2}|present|current)\b/i.test(line) ||
        /\b(engineer|developer|intern|architect|scientist|lead|manager)\b/i.test(line)) &&
      line.length < 110;

    if (looksLikeRoleHeader) {
      if (currentGroup.bullets.length > 0) {
        experience.push(currentGroup);
      }
      currentGroup = { header: line, bullets: [] };
    } else if (isBullet && line.replace(/^([•\-*–—]|\d+\.)\s+/, "").length > 14) {
      currentGroup.bullets.push(auditBullet(line));
    }
  }
  if (currentGroup.bullets.length > 0) {
    experience.push(currentGroup);
  }

  // If user pasted prose paragraphs with no bullet prefixes, sample meaningful action sentences
  const allBullets = experience.flatMap((e) => e.bullets);
  if (allBullets.length === 0 && normalized.length > 80) {
    const sentences = normalized
      .split(/[.\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 28 && !s.includes("@"))
      .slice(0, 6);
    if (sentences.length > 0) {
      experience.push({
        header: "Detected Statements",
        bullets: sentences.map(auditBullet),
      });
    }
  }

  const finalBullets = experience.flatMap((e) => e.bullets);
  const withMetrics = finalBullets.filter((b) => b.hasMetric).length;
  const withActionVerbs = finalBullets.filter((b) => b.hasActionVerb).length;
  const needsWork = finalBullets.filter((b) => b.issues.length > 0).length;

  // Target skill matching (from JD if supplied, else role defaults)
  const jdLower = jobDescription.toLowerCase();
  const jdSkills = jobDescription.trim()
    ? Array.from(
        new Set(
          Object.values(SKILL_TAXONOMY)
            .flat()
            .filter((s) => containsSkillTerm(jdLower, s)),
        ),
      )
    : [];

  const roleDefaults = getRoleTargetSkills(role);
  const targetSkills = jdSkills.length > 0 ? jdSkills : roleDefaults;
  const matchedTarget = targetSkills.filter((s) => containsSkillTerm(lower, s));
  const missingTarget = targetSkills.filter((s) => !matchedTarget.includes(s));
  const matchPct = targetSkills.length
    ? Math.round((matchedTarget.length / targetSkills.length) * 100)
    : 0;

  const coreSectionsCount = ["experience", "education", "skills", "projects"].filter((s) =>
    sectionsFound.includes(s),
  ).length;
  const sectionCompleteness = Math.round((coreSectionsCount / 4) * 100);
  const impactEvidence =
    finalBullets.length > 0
      ? Math.min(
          100,
          Math.round(
            ((withMetrics * 1.4 + withActionVerbs * 0.6) / (finalBullets.length * 1.6)) * 100,
          ),
        )
      : normalized.length > 200
        ? 30
        : 0;

  const overall = normalized.length
    ? Math.round(matchPct * 0.45 + sectionCompleteness * 0.3 + impactEvidence * 0.25)
    : 0;

  return {
    contact: {
      name,
      email: emailMatch?.[0] ?? "",
      phone: phoneMatch?.[0] ?? "",
      links: linkMatches,
    },
    sectionsFound,
    missingSections,
    skillGroups,
    allSkills,
    education,
    certifications,
    experience,
    bulletStats: {
      total: finalBullets.length,
      withMetrics,
      withActionVerbs,
      needsWork,
    },
    jdMatch: {
      targetSkills,
      matched: matchedTarget,
      missing: missingTarget,
      matchPct,
    },
    score: {
      overall,
      keywordAlignment: matchPct,
      sectionCompleteness,
      impactEvidence,
    },
    wordCount: normalized ? normalized.split(/\s+/).length : 0,
    extractedAt: new Date().toISOString(),
  };
}

export function getRoleTargetSkills(role: string): string[] {
  const r = role.toLowerCase();
  if (r.includes("frontend")) {
    return ["React", "TypeScript", "JavaScript", "HTML", "CSS", "Accessibility", "Testing"];
  }
  if (r.includes("backend")) {
    return ["Node.js", "PostgreSQL", "SQL", "DBMS", "System design", "Redis", "Docker"];
  }
  if (r.includes("ml") || r.includes("data")) {
    return [
      "Python",
      "SQL",
      "Machine Learning",
      "PyTorch",
      "Pandas",
      "Data Engineering",
      "System design",
    ];
  }
  if (r.includes("devops")) {
    return ["Docker", "Kubernetes", "AWS", "CI/CD", "Linux", "System design", "Security"];
  }
  return ["DSA", "DBMS", "Python", "SQL", "System design", "TypeScript", "OOP"];
}

export const SAMPLE_RESUME_TEXT = `Maya Kulkarni
maya.kulkarni@example.dev | +1 (415) 555-0148 | github.com/mayakulkarni | linkedin.com/in/mayakulkarni

SUMMARY
Software Engineer with 3 years of experience building low-latency web applications, PostgreSQL-backed APIs, and distributed caching pipelines.

TECHNICAL SKILLS
Languages: TypeScript, JavaScript, Python, SQL
Frontend: React, Next.js, Tailwind CSS, Accessibility
Backend & Databases: Node.js, Express, PostgreSQL, DBMS, Redis, REST
Systems & Cloud: System design, Docker, AWS, CI/CD, DSA, OOP

EXPERIENCE
Senior Software Engineer — Nimbus Commerce (2023 – Present)
• Architected a Redis cache-aside layer for catalog search, reducing p95 API latency by 42% across 120k daily users.
• Migrated core checkout queries to indexed PostgreSQL transactions, eliminating deadlocks and cutting timeout errors by 68%.
• Responsible for frontend performance improvements across React product pages.

Software Engineer — Cedar Labs (2021 – 2023)
• Built an automated TypeScript accessibility & regression suite covering 85+ UI flows in CI/CD.
• Helped with data ingestion pipelines in Python.

PROJECTS
QueryLens — Interactive SQL Explain Visualizer
• Designed a browser-based query plan inspector and index advisor using TypeScript and React.

EDUCATION
B.Tech in Computer Science — National Institute of Technology (2017 – 2021) · CGPA 8.9/10

CERTIFICATIONS
AWS Certified Developer – Associate`;

export const SAMPLE_JD_TEXT = `We are hiring a Software Engineer to scale our core product platform.
Requirements:
- Strong proficiency in TypeScript, React, Node.js, and Python.
- Solid foundation in DSA, OOP, DBMS, and relational SQL query tuning (PostgreSQL).
- Experience with System design, Redis caching, Docker, and CI/CD pipelines.`;
