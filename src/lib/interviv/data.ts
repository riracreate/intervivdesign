export const skills = [
  "DSA",
  "DBMS",
  "OOP",
  "Python",
  "SQL",
  "System design",
  "JavaScript",
  "React",
  "TypeScript",
  "Java",
  "C++",
  "Operating Systems",
  "Computer Networks",
  "Backend",
  "Frontend",
  "DevOps & Cloud",
  "Machine Learning",
  "AI & LLMs",
  "Data Engineering",
  "Mobile",
  "Security",
  "Behavioral",
];
export const companies = [
  "Google",
  "Amazon",
  "Microsoft",
  "Meta",
  "TCS",
  "Infosys",
  "Wipro",
  "Accenture",
];
export const modes = [
  {
    id: "interview",
    title: "Mock interview",
    description: "Find your words. Build your confidence.",
    icon: "mic",
    tone: "sage",
    time: "15–30 min",
  },
  {
    id: "coding",
    title: "Coding practice",
    description: "Work through problems. Sharpen your thinking.",
    icon: "code",
    tone: "lavender",
    time: "20–45 min",
  },
  {
    id: "oa",
    title: "OA practice",
    description: "Get comfortable with the fundamentals.",
    icon: "database",
    tone: "peach",
    time: "10–30 min",
  },
  {
    id: "sql",
    title: "SQL practice",
    description: "Turn your data knowledge into working queries.",
    icon: "database",
    tone: "peach",
    time: "15–30 min",
  },
  {
    id: "design",
    title: "System design",
    description: "Make the trade-offs behind scalable systems.",
    icon: "layers",
    tone: "sage",
    time: "20–45 min",
  },
  {
    id: "behavioral",
    title: "Behavioral / HR",
    description: "Tell the story behind your best work.",
    icon: "mic",
    tone: "peach",
    time: "15–30 min",
  },
  {
    id: "full",
    title: "Full interview",
    description: "A focused rotation through your selected skills.",
    icon: "layers",
    tone: "sage",
    time: "30–60 min",
  },
  {
    id: "verbal",
    title: "Verbal ability",
    description: "Practice clear, precise communication.",
    icon: "book",
    tone: "lavender",
    time: "10–20 min",
  },
  {
    id: "combined",
    title: "OA + SQL",
    description: "A technical assessment, from concepts to queries.",
    icon: "database",
    tone: "peach",
    time: "20–60 min",
  },
  {
    id: "ml",
    title: "ML primitives",
    description: "Build the fundamentals, one implementation at a time.",
    icon: "code",
    tone: "lavender",
    time: "20–45 min",
  },
  {
    id: "custom",
    title: "Custom interview",
    description: "Build your own sequence of interview blocks.",
    icon: "layers",
    tone: "sage",
    time: "Your pace",
  },
];
export const problems = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    topics: ["DSA", "Arrays"],
    statement:
      "Given an array of integers nums and an integer target, return the indices of the two numbers that add up to target. Each input has exactly one solution; do not reuse the same element.",
    example: "nums = [2, 7, 11, 15], target = 9 → [0, 1]",
    code: "function twoSum(nums, target) {\n  // Your solution here\n}",
    hint: "Store previously seen values in a map and look for the complement.",
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    topics: ["DSA", "Stacks"],
    statement:
      "Determine whether every opening bracket is closed by the same type of bracket in the correct order.",
    example: '"({[]})" → true',
    code: "function isValid(s) {\n  // Your solution here\n}",
    hint: "A stack preserves the order of the most recent opening brackets.",
  },
  {
    id: "longest-substring",
    title: "Longest Unique Substring",
    difficulty: "Medium",
    topics: ["DSA", "Strings"],
    statement: "Find the length of the longest substring without repeating characters.",
    example: '"abcabcbb" → 3',
    code: "function lengthOfLongestSubstring(s) {\n  // Your solution here\n}",
    hint: "Use a sliding window and track the last position of each character.",
  },
  {
    id: "merge-intervals",
    title: "Merge Intervals",
    difficulty: "Medium",
    topics: ["DSA", "Arrays"],
    statement:
      "Merge all overlapping intervals and return the resulting non-overlapping intervals.",
    example: "[[1,3],[2,6],[8,10]] → [[1,6],[8,10]]",
    code: "function merge(intervals) {\n  // Your solution here\n}",
    hint: "Sort intervals by starting point before comparing neighbors.",
  },
  {
    id: "lru-cache",
    title: "LRU Cache",
    difficulty: "Hard",
    topics: ["DSA", "System design"],
    statement: "Design a least recently used cache with O(1) average get and put operations.",
    example: "capacity = 2; put(1,1); put(2,2); get(1) → 1",
    code: "class LRUCache {\n  constructor(capacity) {}\n  get(key) {}\n  put(key, value) {}\n}",
    hint: "Combine a hash map with a doubly linked list.",
  },
  {
    id: "binary-search",
    title: "Binary Search",
    difficulty: "Easy",
    topics: ["DSA", "Search"],
    statement:
      "Return the index of target in a sorted array, or -1 if it does not exist. Use O(log n) time.",
    example: "[-1,0,3,5,9,12], target = 9 → 4",
    code: "function search(nums, target) {\n  // Your solution here\n}",
    hint: "Shrink your search interval by half with each comparison.",
  },
];
export type Question = {
  id: string;
  skill: string;
  prompt: string;
  concepts: string[];
  hint: string;
  options?: string[];
  correct?: number;
  type?: string;
};
export const questions: Question[] = [
  {
    id: "index",
    skill: "DBMS",
    prompt: "How does a database index work, and when would you choose not to use one?",
    concepts: ["index", "read", "write", "b-tree", "space"],
    hint: "Think about the trade-off between faster reads and maintenance during writes.",
  },
  {
    id: "transaction",
    skill: "DBMS",
    prompt: "Explain ACID transactions with an example of a bank transfer.",
    concepts: ["atomic", "consisten", "isola", "durab", "transfer"],
    hint: "A transfer must debit and credit together, even when something fails.",
  },
  {
    id: "hash",
    skill: "DSA",
    prompt: "Compare a hash table and a binary search tree. When would you choose each?",
    concepts: ["hash", "search", "order", "collision", "log"],
    hint: "Consider average lookup time, ordering and worst-case behavior.",
  },
  {
    id: "oop",
    skill: "OOP",
    prompt: "Explain composition versus inheritance using a real software example.",
    concepts: ["composition", "inherit", "coupl", "interface", "example"],
    hint: "Think about a has-a relationship versus an is-a relationship.",
  },
  {
    id: "python",
    skill: "Python",
    prompt: "What are generators in Python, and how do they help with large data pipelines?",
    concepts: ["yield", "memory", "iterator", "lazy", "pipeline"],
    hint: "Consider when a value is produced and whether the whole collection is in memory.",
  },
  {
    id: "design",
    skill: "System design",
    prompt:
      "Design a URL shortener that supports 10 million daily requests. Describe storage, caching, availability and trade-offs.",
    concepts: ["cache", "database", "load", "replica", "trade"],
    hint: "Start with requirements, then follow a request through your architecture.",
  },
  {
    id: "behavioral",
    skill: "Behavioral",
    prompt: "Tell me about a time you resolved a difficult disagreement within your team.",
    concepts: ["situation", "task", "i ", "result", "learn"],
    hint: "Use Situation, Task, Action and Result. Be specific about your own contribution.",
  },
  {
    id: "oa1",
    skill: "DSA",
    prompt: "What is the average lookup time complexity of a hash table?",
    concepts: [],
    hint: "Think about a direct lookup with a good hash function.",
    options: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
    correct: 0,
    type: "mcq",
  },
  {
    id: "oa2",
    skill: "DBMS",
    prompt: "Which SQL clause filters grouped aggregate results?",
    concepts: [],
    hint: "WHERE applies before grouping.",
    options: ["WHERE", "ORDER BY", "HAVING", "LIMIT"],
    correct: 2,
    type: "mcq",
  },
  {
    id: "verbal",
    skill: "Behavioral",
    prompt: "Choose the grammatically correct sentence.",
    concepts: [],
    hint: "The subject is singular.",
    options: [
      "Each of the candidates are ready.",
      "Each of the candidates is ready.",
      "Each candidates is ready.",
      "Each of candidates were ready.",
    ],
    correct: 1,
    type: "mcq",
  },
  {
    id: "react-render",
    skill: "React",
    prompt:
      "Explain why mutating React state in place breaks re-rendering, and how reconciliation updates DOM nodes.",
    concepts: ["immutab", "reference", "reconcil", "key", "virtual"],
    hint: "React compares object references with Object.is and relies on stable keys for sibling reconciliation.",
  },
  {
    id: "ts-narrowing",
    skill: "TypeScript",
    prompt:
      "How do discriminated unions and exhaustive checks prevent runtime bugs compared to optional fields on one interface?",
    concepts: ["discriminat", "union", "narrow", "never", "type"],
    hint: "A shared literal tag lets the compiler narrow each branch and catch missing cases with never.",
  },
  {
    id: "sql-join-index",
    skill: "SQL",
    prompt:
      "Compare LEFT JOIN filtering in ON versus WHERE, and explain how a composite index supports WHERE a = ? ORDER BY b.",
    concepts: ["left join", "null", "where", "composite", "order"],
    hint: "Filtering the right table in WHERE turns a LEFT JOIN into an inner join by dropping NULL rows.",
  },
  {
    id: "cache-invalidation",
    skill: "System design",
    prompt:
      "Walk through cache-aside vs write-through caching. How do you prevent a cache stampede when a hot key TTL expires?",
    concepts: ["cache-aside", "write-through", "ttl", "stampede", "lock"],
    hint: "Consider request coalescing, jittered TTLs, or stale-while-revalidate.",
  },
  {
    id: "oa-complexity",
    skill: "DSA",
    prompt: "When does quicksort degrade to O(n²), and why does mergesort avoid that worst case?",
    concepts: [],
    hint: "Think about pivot selection on already-sorted input vs guaranteed midpoint splits.",
    options: [
      "Bad pivot choices produce unbalanced partitions; mergesort always splits in half",
      "Quicksort uses extra heap memory; mergesort runs strictly in-place",
      "Quicksort cannot sort negative integers",
      "Mergesort skips comparisons on duplicate elements",
    ],
    correct: 0,
    type: "mcq",
  },
  {
    id: "oa-http-idempotency",
    skill: "Backend",
    prompt: "Which HTTP method is designed to be idempotent when retried after a network timeout?",
    concepts: [],
    hint: "Repeating this method updates or replaces a known resource state without duplicating side effects.",
    options: ["POST", "PUT", "CONNECT", "PATCH (non-atomic append)"],
    correct: 1,
    type: "mcq",
  },
];
export const resources: [string, string, string, string, string][] = [
  ["DSA", "Visualize data structures", "VisuAlgo", "Beginner", "https://visualgo.net/en"],
  [
    "DSA",
    "Algorithms, explained",
    "Khan Academy",
    "Beginner",
    "https://www.khanacademy.org/computing/computer-science/algorithms",
  ],
  [
    "DSA",
    "Practice interview problems",
    "LeetCode",
    "Intermediate",
    "https://leetcode.com/problemset/",
  ],
  [
    "System design",
    "System design primer",
    "Donne Martin",
    "Intermediate",
    "https://github.com/donnemartin/system-design-primer",
  ],
  [
    "System design",
    "Distributed systems lectures",
    "MIT",
    "Advanced",
    "https://pdos.csail.mit.edu/6.824/",
  ],
  ["SQL", "SQL, one lesson at a time", "SQLBolt", "Beginner", "https://sqlbolt.com/"],
  ["SQL", "PostgreSQL documentation", "PostgreSQL", "Advanced", "https://www.postgresql.org/docs/"],
  [
    "Python",
    "The Python tutorial",
    "Python.org",
    "Beginner",
    "https://docs.python.org/3/tutorial/",
  ],
  [
    "JavaScript",
    "JavaScript guide",
    "MDN",
    "Beginner",
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
  ],
  [
    "TypeScript",
    "TypeScript handbook",
    "TypeScript",
    "Intermediate",
    "https://www.typescriptlang.org/docs/handbook/intro.html",
  ],
  [
    "React",
    "Thinking in React",
    "React",
    "Intermediate",
    "https://react.dev/learn/thinking-in-react",
  ],
  [
    "Backend",
    "High scalability patterns",
    "Martin Fowler",
    "Intermediate",
    "https://martinfowler.com/architecture/",
  ],
  [
    "Behavioral",
    "Interview preparation",
    "Yale Office of Career Strategy",
    "Beginner",
    "https://ocs.yale.edu/channels/interview-preparation/",
  ],
  ["DBMS", "Database systems lectures", "CMU", "Advanced", "https://15445.courses.cs.cmu.edu/"],
  [
    "Machine Learning",
    "Machine learning crash course",
    "Google",
    "Beginner",
    "https://developers.google.com/machine-learning/crash-course",
  ],
  [
    "Resume / ATS",
    "Resumes and cover letters",
    "Harvard",
    "Beginner",
    "https://careerservices.fas.harvard.edu/resources/",
  ],
];
export function makeQuestions(mode: string, focus: string[], count: number): Question[] {
  const pool =
    mode === "oa" || mode === "verbal"
      ? questions.filter((q) => q.type === "mcq" && (mode !== "verbal" || q.id === "verbal"))
      : questions.filter(
          (q) =>
            !q.type &&
            (mode === "design"
              ? q.skill === "System design"
              : mode === "behavioral"
                ? q.skill === "Behavioral"
                : focus.includes(q.skill)),
        );
  const source = pool.length ? pool : questions.filter((q) => !q.type);
  return Array.from({ length: count }, (_, i) => {
    const question = source[i % source.length];
    if (!question) throw new Error("Practice content unavailable.");
    return { ...question, id: `${question.id}-${i}` };
  });
}
export function evaluate(q: Question, answer: string, selected: number | null) {
  if (q.type === "mcq")
    return {
      score: selected === q.correct ? 100 : 0,
      coverage: selected === q.correct ? 10 : 0,
      clarity: 10,
      depth: 10,
      correctness: selected === q.correct ? 10 : 0,
      missing: [],
      feedback:
        selected === q.correct
          ? "Correct. Keep this concept in your toolkit."
          : `The correct answer is ${q.options?.[q.correct ?? 0]}. ${q.hint}`,
    };
  const text = answer.toLowerCase();
  const missing = q.concepts.filter((c) => !text.includes(c));
  const coverage = Math.round(
    ((q.concepts.length - missing.length) / Math.max(q.concepts.length, 1)) * 10,
  );
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const depth = Math.min(10, Math.round(words / 15));
  const clarity =
    words > 10
      ? Math.min(
          10,
          5 +
            (text.includes("example") ? 2 : 0) +
            (text.includes("however") || text.includes("trade") ? 3 : 0),
        )
      : 2;
  return {
    score: Math.round(((coverage * 2 + depth + clarity) / 4) * 10),
    coverage,
    correctness: coverage,
    clarity,
    depth,
    missing,
    feedback: missing.length
      ? `Build on your answer by covering: ${missing.join(", ")}. Include one concrete example and explain the trade-off.`
      : "Good concept coverage. Keep your explanation specific and make the trade-off explicit.",
  };
}
export const reviewIntervals = [1, 3, 7, 16, 35];
export function nextReview(correct: boolean, stage: number) {
  return correct ? (reviewIntervals[Math.min(stage + 1, 4)] ?? 35) : 1;
}
export function gapSeverity(gap: number, attempts: number) {
  return !attempts ? "Untested" : gap > 25 ? "High" : gap > 10 ? "Medium" : "Low";
}
export function validPassword(s: string) {
  return s.length >= 8 && /[a-z]/i.test(s) && /\d/.test(s);
}
