// ─── Shareable public report card ─────────────────────────────────────────────
// The card payload travels inside the link itself (base64url JSON). Nothing
// private is fetched for anonymous viewers: the owner chooses to share this
// summary, and the link is the consent. Validate everything on decode.

export type ReportCardData = {
  v: 1;
  title: string;
  score: number | null;
  skills: string[];
  rounds: number;
  date: string;
  level: number;
  xp: number;
  topSkill: string;
};

function toBase64Url(text: string): string {
  const b64 = btoa(unescape(encodeURIComponent(text)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return decodeURIComponent(escape(atob(padded)));
}

export function encodeReportCard(data: ReportCardData): string {
  return toBase64Url(JSON.stringify(data));
}

export function decodeReportCard(code: string | undefined): ReportCardData | null {
  if (!code || code.length > 4000) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(code)) as Partial<ReportCardData>;
    if (parsed.v !== 1) return null;
    if (typeof parsed.title !== "string" || !Array.isArray(parsed.skills)) return null;
    return {
      v: 1,
      title: parsed.title.slice(0, 120),
      score:
        typeof parsed.score === "number"
          ? Math.max(0, Math.min(100, Math.round(parsed.score)))
          : null,
      skills: parsed.skills.filter((s): s is string => typeof s === "string").slice(0, 8),
      rounds: typeof parsed.rounds === "number" ? Math.max(0, Math.floor(parsed.rounds)) : 0,
      date: typeof parsed.date === "string" ? parsed.date.slice(0, 40) : "",
      level: typeof parsed.level === "number" ? Math.max(1, Math.floor(parsed.level)) : 1,
      xp: typeof parsed.xp === "number" ? Math.max(0, Math.floor(parsed.xp)) : 0,
      topSkill: typeof parsed.topSkill === "string" ? parsed.topSkill.slice(0, 60) : "—",
    };
  } catch {
    return null;
  }
}

export function reportCardPath(data: ReportCardData): string {
  return `/report-card?d=${encodeReportCard(data)}`;
}
