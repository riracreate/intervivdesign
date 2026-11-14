export type TestCase = {
  id: string;
  label: string;
  args: unknown[];
  expected: unknown;
};

export type TestCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  actual: unknown;
  expected: unknown;
  error?: string;
  durationMs: number;
};

export type CodeExecutionResult = {
  ok: boolean;
  passedCount: number;
  totalCount: number;
  results: TestCaseResult[];
  logs: string[];
  compileError?: string;
};

export type CodingChallenge = {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topics: string[];
  statement: string;
  example: string;
  fnName: string;
  mode: "function" | "lru";
  code: string;
  solution: string;
  hint: string;
  complexity: string;
  tests: TestCase[];
};

export const codingChallenges: CodingChallenge[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    topics: ["DSA", "Arrays", "Hash Map"],
    statement:
      "Given an array of integers nums and an integer target, return the indices [i, j] of the two numbers that add up to target. Each input has one solution; do not reuse the same index.",
    example: "nums = [2, 7, 11, 15], target = 9 -> [0, 1]",
    fnName: "twoSum",
    mode: "function",
    code: "function twoSum(nums, target) {\n  // Return [i, j] where nums[i] + nums[j] === target\n  \n}",
    solution:
      "function twoSum(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const need = target - nums[i];\n    if (seen.has(need)) return [seen.get(need), i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}",
    hint: "Store previously seen numbers in a Map so you can look up (target - nums[i]) in O(1).",
    complexity: "Target: O(n) time, O(n) space",
    tests: [
      {
        id: "t1",
        label: "Standard pair [2,7,11,15], 9",
        args: [[2, 7, 11, 15], 9],
        expected: [0, 1],
      },
      { id: "t2", label: "Middle indices [3,2,4], 6", args: [[3, 2, 4], 6], expected: [1, 2] },
      { id: "t3", label: "Duplicate values [3,3], 6", args: [[3, 3], 6], expected: [0, 1] },
      {
        id: "t4",
        label: "Negative numbers [-3,4,3,90], 0",
        args: [[-3, 4, 3, 90], 0],
        expected: [0, 2],
      },
    ],
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    topics: ["DSA", "Stacks"],
    statement:
      "Given a string s containing only '(', ')', '{', '}', '[', and ']', return true if every opening bracket is closed by the matching type in the correct order.",
    example: '"({[]})" -> true',
    fnName: "isValid",
    mode: "function",
    code: "function isValid(s) {\n  // Return true if brackets close in valid LIFO order\n  \n}",
    solution:
      "function isValid(s) {\n  const stack = [];\n  const pairs = { '(': ')', '{': '}', '[': ']' };\n  for (const ch of s) {\n    if (pairs[ch]) stack.push(pairs[ch]);\n    else if (stack.pop() !== ch) return false;\n  }\n  return stack.length === 0;\n}",
    hint: "Push the expected closing bracket onto a stack whenever you see an opener.",
    complexity: "Target: O(n) time, O(n) space",
    tests: [
      { id: "t1", label: 'Nested "({[]})"', args: ["({[]})"], expected: true },
      { id: "t2", label: 'Sequential "()[]{}"', args: ["()[]{}"], expected: true },
      { id: "t3", label: 'Mismatched "(]"', args: ["(]"], expected: false },
      { id: "t4", label: 'Unclosed "("', args: ["("], expected: false },
    ],
  },
  {
    id: "longest-substring",
    title: "Longest Unique Substring",
    difficulty: "Medium",
    topics: ["DSA", "Strings", "Sliding Window"],
    statement:
      "Given a string s, find the length of the longest substring without repeating characters.",
    example: '"abcabcbb" -> 3 ("abc")',
    fnName: "lengthOfLongestSubstring",
    mode: "function",
    code: "function lengthOfLongestSubstring(s) {\n  // Track window bounds with a Map of last-seen indices\n  \n}",
    solution:
      "function lengthOfLongestSubstring(s) {\n  const lastSeen = new Map();\n  let left = 0;\n  let best = 0;\n  for (let right = 0; right < s.length; right++) {\n    const ch = s[right];\n    if (lastSeen.has(ch) && lastSeen.get(ch) >= left) {\n      left = lastSeen.get(ch) + 1;\n    }\n    lastSeen.set(ch, right);\n    best = Math.max(best, right - left + 1);\n  }\n  return best;\n}",
    hint: "Maintain a sliding window [left, right] and advance left past any duplicate character's last index.",
    complexity: "Target: O(n) time, O(min(n, alphabet)) space",
    tests: [
      { id: "t1", label: '"abcabcbb"', args: ["abcabcbb"], expected: 3 },
      { id: "t2", label: '"bbbbb"', args: ["bbbbb"], expected: 1 },
      { id: "t3", label: '"pwwkew"', args: ["pwwkew"], expected: 3 },
      { id: "t4", label: 'Empty string ""', args: [""], expected: 0 },
    ],
  },
  {
    id: "merge-intervals",
    title: "Merge Intervals",
    difficulty: "Medium",
    topics: ["DSA", "Arrays", "Sorting"],
    statement:
      "Given an array of intervals [start, end], merge all overlapping intervals and return an array of the non-overlapping intervals sorted by start.",
    example: "[[1,3],[2,6],[8,10]] -> [[1,6],[8,10]]",
    fnName: "merge",
    mode: "function",
    code: "function merge(intervals) {\n  // Sort by start time, then merge overlapping intervals\n  \n}",
    solution:
      "function merge(intervals) {\n  if (!intervals.length) return [];\n  const sorted = intervals.map((x) => [...x]).sort((a, b) => a[0] - b[0]);\n  const out = [sorted[0]];\n  for (let i = 1; i < sorted.length; i++) {\n    const prev = out[out.length - 1];\n    const curr = sorted[i];\n    if (curr[0] <= prev[1]) prev[1] = Math.max(prev[1], curr[1]);\n    else out.push(curr);\n  }\n  return out;\n}",
    hint: "Sort intervals by start time, then compare each start with the previous merged interval's end.",
    complexity: "Target: O(n log n) time, O(n) space",
    tests: [
      {
        id: "t1",
        label: "Partial overlaps [[1,3],[2,6],[8,10],[15,18]]",
        args: [
          [
            [1, 3],
            [2, 6],
            [8, 10],
            [15, 18],
          ],
        ],
        expected: [
          [1, 6],
          [8, 10],
          [15, 18],
        ],
      },
      {
        id: "t2",
        label: "Touching boundaries [[1,4],[4,5]]",
        args: [
          [
            [1, 4],
            [4, 5],
          ],
        ],
        expected: [[1, 5]],
      },
      {
        id: "t3",
        label: "Unsorted nested [[1,4],[0,2],[3,5]]",
        args: [
          [
            [1, 4],
            [0, 2],
            [3, 5],
          ],
        ],
        expected: [[0, 5]],
      },
    ],
  },
  {
    id: "binary-search",
    title: "Binary Search",
    difficulty: "Easy",
    topics: ["DSA", "Search"],
    statement:
      "Given a sorted array of distinct integers nums and a target integer, return the index of target or -1 if not found.",
    example: "[-1,0,3,5,9,12], target = 9 -> 4",
    fnName: "search",
    mode: "function",
    code: "function search(nums, target) {\n  // Binary search within [lo, hi]\n  \n}",
    solution:
      "function search(nums, target) {\n  let lo = 0;\n  let hi = nums.length - 1;\n  while (lo <= hi) {\n    const mid = (lo + hi) >> 1;\n    if (nums[mid] === target) return mid;\n    if (nums[mid] < target) lo = mid + 1;\n    else hi = mid - 1;\n  }\n  return -1;\n}",
    hint: "Maintain inclusive bounds [lo, hi] and halve the search interval on every iteration.",
    complexity: "Target: O(log n) time, O(1) space",
    tests: [
      { id: "t1", label: "Target present (9)", args: [[-1, 0, 3, 5, 9, 12], 9], expected: 4 },
      { id: "t2", label: "Target absent (2)", args: [[-1, 0, 3, 5, 9, 12], 2], expected: -1 },
      { id: "t3", label: "Single element match", args: [[5], 5], expected: 0 },
    ],
  },
  {
    id: "lru-cache",
    title: "LRU Cache",
    difficulty: "Hard",
    topics: ["DSA", "System design"],
    statement:
      "Implement class LRUCache(capacity) with get(key) returning value or -1, and put(key, value) evicting the least recently used key when full.",
    example: "cap=2; put(1,1); put(2,2); get(1)->1; put(3,3); get(2)->-1",
    fnName: "LRUCache",
    mode: "lru",
    code: "class LRUCache {\n  constructor(capacity) {\n    this.capacity = capacity;\n  }\n  get(key) {\n    return -1;\n  }\n  put(key, value) {\n    \n  }\n}",
    solution:
      "class LRUCache {\n  constructor(capacity) {\n    this.capacity = capacity;\n    this.map = new Map();\n  }\n  get(key) {\n    if (!this.map.has(key)) return -1;\n    const val = this.map.get(key);\n    this.map.delete(key);\n    this.map.set(key, val);\n    return val;\n  }\n  put(key, value) {\n    if (this.map.has(key)) this.map.delete(key);\n    this.map.set(key, value);\n    if (this.map.size > this.capacity) {\n      const oldestKey = this.map.keys().next().value;\n      this.map.delete(oldestKey);\n    }\n  }\n}",
    hint: "JavaScript's Map preserves insertion order — deleting and re-inserting moves a key to most-recently-used.",
    complexity: "Target: O(1) average get & put, O(capacity) space",
    tests: [
      {
        id: "t1",
        label: "Eviction after get refresh",
        args: [
          2,
          [
            ["put", 1, 1],
            ["put", 2, 2],
            ["get", 1],
            ["put", 3, 3],
            ["get", 2],
            ["put", 4, 4],
            ["get", 1],
            ["get", 3],
            ["get", 4],
          ],
        ],
        expected: [1, -1, -1, 3, 4],
      },
      {
        id: "t2",
        label: "Overwrite existing key refreshes recency",
        args: [
          2,
          [
            ["put", 1, 10],
            ["put", 2, 20],
            ["put", 1, 15],
            ["put", 3, 30],
            ["get", 2],
            ["get", 1],
          ],
        ],
        expected: [-1, 15],
      },
    ],
  },
];

export type SqlChallenge = {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium";
  prompt: string;
  tableName: string;
  schema: string;
  rows: Record<string, unknown>[];
  starterSql: string;
  expectedRows: Record<string, unknown>[];
  orderSensitive: boolean;
  hint: string;
};

export const sqlChallenges: SqlChallenge[] = [
  {
    id: "high-earners",
    title: "High-earning engineers",
    difficulty: "Easy",
    prompt: "Find employees earning strictly more than 80,000. Return name and salary.",
    tableName: "employees",
    schema: "employees (name TEXT, department TEXT, salary INTEGER)",
    rows: [
      { name: "Ada", department: "Engineering", salary: 95000 },
      { name: "Lin", department: "Engineering", salary: 75000 },
      { name: "Sam", department: "Design", salary: 80000 },
      { name: "Noor", department: "Platform", salary: 112000 },
    ],
    starterSql: "SELECT name, salary FROM ? WHERE salary > 80000 ORDER BY salary DESC",
    expectedRows: [
      { name: "Noor", salary: 112000 },
      { name: "Ada", salary: 95000 },
    ],
    orderSensitive: false,
    hint: "Use WHERE salary > 80000 and select only name and salary columns.",
  },
  {
    id: "dept-headcount",
    title: "Department headcount & average pay",
    difficulty: "Medium",
    prompt:
      "Return each department with more than 1 employee along with its headcount AS headcount.",
    tableName: "employees",
    schema: "employees (name TEXT, department TEXT, salary INTEGER)",
    rows: [
      { name: "Ada", department: "Engineering", salary: 95000 },
      { name: "Lin", department: "Engineering", salary: 75000 },
      { name: "Sam", department: "Design", salary: 80000 },
      { name: "Noor", department: "Platform", salary: 112000 },
      { name: "Kai", department: "Engineering", salary: 88000 },
    ],
    starterSql:
      "SELECT department, COUNT(*) AS headcount FROM ? GROUP BY department HAVING COUNT(*) > 1",
    expectedRows: [{ department: "Engineering", headcount: 3 }],
    orderSensitive: false,
    hint: "WHERE runs before grouping; HAVING filters grouped aggregate counts.",
  },
];

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  if (Array.isArray(a) || Array.isArray(b)) return false;
  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) => Object.hasOwn(bObj, k) && deepEqual(aObj[k], bObj[k]));
  }
  return false;
}

export function runJavaScriptChallenge(
  challenge: CodingChallenge,
  sourceCode: string,
): CodeExecutionResult {
  const logs: string[] = [];
  const customConsole = {
    log: (...args: unknown[]) => {
      if (logs.length < 40) {
        logs.push(args.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
      }
    },
  };

  let targetFactory: ((consoleArg: typeof customConsole) => unknown) | null = null;
  try {
    targetFactory = new Function(
      "console",
      `"use strict";\n${sourceCode}\nreturn typeof ${challenge.fnName} !== "undefined" ? ${challenge.fnName} : null;`,
    ) as (consoleArg: typeof customConsole) => unknown;
  } catch (e) {
    return {
      ok: false,
      passedCount: 0,
      totalCount: challenge.tests.length,
      results: [],
      logs,
      compileError: e instanceof Error ? e.message : "Syntax error in code.",
    };
  }

  let target: unknown;
  try {
    target = targetFactory(customConsole);
  } catch (e) {
    return {
      ok: false,
      passedCount: 0,
      totalCount: challenge.tests.length,
      results: [],
      logs,
      compileError: e instanceof Error ? e.message : "Runtime error while loading solution.",
    };
  }

  if (!target) {
    return {
      ok: false,
      passedCount: 0,
      totalCount: challenge.tests.length,
      results: [],
      logs,
      compileError: `Could not find ${challenge.fnName}. Keep the provided function or class name.`,
    };
  }

  const results: TestCaseResult[] = challenge.tests.map((tc) => {
    const start = performance.now();
    try {
      let actual: unknown;
      if (challenge.mode === "lru") {
        const CacheCtor = target as new (cap: number) => {
          get: (k: number) => number;
          put: (k: number, v: number) => void;
        };
        const [capacity, ops] = tc.args as [
          number,
          Array<["get", number] | ["put", number, number]>,
        ];
        const instance = new CacheCtor(capacity);
        const outputs: number[] = [];
        for (const op of ops) {
          if (op[0] === "put") instance.put(op[1], op[2]);
          else outputs.push(instance.get(op[1]));
        }
        actual = outputs;
      } else {
        const fn = target as (...args: unknown[]) => unknown;
        const clonedArgs = structuredClone(tc.args);
        actual = fn(...clonedArgs);
      }
      const passed = deepEqual(actual, tc.expected);
      return {
        id: tc.id,
        label: tc.label,
        passed,
        actual,
        expected: tc.expected,
        durationMs: Math.max(0.01, Number((performance.now() - start).toFixed(2))),
      };
    } catch (e) {
      return {
        id: tc.id,
        label: tc.label,
        passed: false,
        actual: undefined,
        expected: tc.expected,
        error: e instanceof Error ? e.message : "Execution error",
        durationMs: Math.max(0.01, Number((performance.now() - start).toFixed(2))),
      };
    }
  });

  const passedCount = results.filter((r) => r.passed).length;
  return {
    ok: passedCount === results.length,
    passedCount,
    totalCount: results.length,
    results,
    logs,
  };
}

function canonicalRow(row: Record<string, unknown>) {
  const entries = Object.entries(row)
    .map(([k, v]) => [k.toLowerCase(), v] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(Object.fromEntries(entries));
}

export function gradeSqlRows(
  actualRows: Record<string, unknown>[],
  expectedRows: Record<string, unknown>[],
  orderSensitive = false,
): { passed: boolean; feedback: string } {
  if (!Array.isArray(actualRows)) {
    return { passed: false, feedback: "Query did not return a row set." };
  }
  if (actualRows.length !== expectedRows.length) {
    return {
      passed: false,
      feedback: `Expected ${expectedRows.length} row(s), but your query returned ${actualRows.length}.`,
    };
  }
  const actualCanon = actualRows.map(canonicalRow);
  const expectedCanon = expectedRows.map(canonicalRow);
  const matches = orderSensitive
    ? actualCanon.every((v, idx) => v === expectedCanon[idx])
    : deepEqual([...actualCanon].sort(), [...expectedCanon].sort());

  return matches
    ? {
        passed: true,
        feedback: `All ${expectedRows.length} expected row(s) matched with exact columns and values.`,
      }
    : {
        passed: false,
        feedback: "Row count matches, but column names or values differ from the expected output.",
      };
}
