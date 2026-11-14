// ─── Communication analytics (transcript-based, disclosed) ────────────────────
// Filler counts and pace are estimates from words + timing. Without word
// timings, pause detection reports punctuation pauses only — never invented.

export const FILLER_WORDS = [
  "um",
  "uh",
  "erm",
  "ah",
  "like",
  "you know",
  "i mean",
  "actually",
  "basically",
  "literally",
  "sort of",
  "kind of",
] as const;

export type WordTiming = { word: string; startMs: number; endMs: number };

export type Pause = { afterWord: string; gapMs: number; atMs: number };

export type CommunicationStats = {
  words: number;
  durationMs: number | null;
  /** null when duration is unknown — we never guess a speaking time. */
  wordsPerMinute: number | null;
  fillerCount: number;
  fillerBreakdown: Record<string, number>;
  fillerPer100Words: number;
  pauses: Pause[];
  longestPauseMs: number;
};

export function countFillers(transcript: string): {
  total: number;
  breakdown: Record<string, number>;
} {
  const text = ` ${transcript.toLowerCase().replace(/[^a-z' ]+/g, " ")} `;
  const breakdown: Record<string, number> = {};
  let total = 0;
  for (const f of FILLER_WORDS) {
    const needle = ` ${f} `;
    let count = 0;
    let idx = text.indexOf(needle);
    while (idx !== -1) {
      count++;
      idx = text.indexOf(needle, idx + needle.length);
    }
    if (count) breakdown[f] = count;
    total += count;
  }
  return { total, breakdown };
}

/** Pauses = silent gaps ≥ threshold between consecutive timed words. */
export function detectPauses(timings: WordTiming[], thresholdMs = 600): Pause[] {
  const sorted = [...timings].sort((a, b) => a.startMs - b.startMs);
  const pauses: Pause[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const gap = cur.startMs - prev.endMs;
    if (gap >= thresholdMs)
      pauses.push({ afterWord: prev.word, gapMs: Math.round(gap), atMs: prev.endMs });
  }
  return pauses;
}

/** Punctuation pauses (… / — / sentence ends) — used when no timings exist. */
export function punctuationPauses(transcript: string): number {
  return (transcript.match(/…|\.\.\.|—/g) ?? []).length;
}

export function analyzeCommunication(params: {
  transcript: string;
  durationMs?: number | null;
  timings?: WordTiming[];
}): CommunicationStats {
  const words = params.transcript.trim().split(/\s+/).filter(Boolean).length;
  const durationMs = params.durationMs != null && params.durationMs > 0 ? params.durationMs : null;
  const wordsPerMinute = durationMs ? Math.round(words / (durationMs / 60_000)) : null;
  const { total, breakdown } = countFillers(params.transcript);
  const pauses = params.timings?.length ? detectPauses(params.timings) : [];
  return {
    words,
    durationMs,
    wordsPerMinute,
    fillerCount: total,
    fillerBreakdown: breakdown,
    fillerPer100Words: words ? Math.round((total / words) * 1000) / 10 : 0,
    pauses,
    longestPauseMs: pauses.reduce((m, p) => Math.max(m, p.gapMs), 0),
  };
}

/** Friendly pace band for spoken answers (typical interview speech 110–160 wpm). */
export function paceLabel(wpm: number | null): string {
  if (wpm == null) return "Add timing to measure pace";
  if (wpm < 90) return "Unhurried — pauses give your ideas room";
  if (wpm <= 170) return "Conversational pace";
  return "Brisk — slow down on key points";
}
