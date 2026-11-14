import type { Question } from "./data";
import { evaluate } from "./data";

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceEntry = {
  id: string;
  questionId: string;
  questionText: string;
  skill: string;
  // spoken answer transcript
  transcript: string;
  // deterministic score from evaluate() — 0-100
  score: number;
  coverage: number;
  depth: number;
  clarity: number;
  // ISO strings
  askedAt: string;
  answeredAt: string | null;
  durationMs: number | null;
  isFollowUp: boolean;
  parentQuestionId: string | null;
};

export type VoiceSession = {
  id: string;
  userId: string;
  title: string;
  skills: string[];
  entries: VoiceEntry[];
  createdAt: string;
  completedAt: string | null;
};

// ─── Web Speech helpers (browser-only, guarded) ───────────────────────────────

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string; confidence: number };
    length: number;
  }>;
}

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const ctor = (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"]) as
    SpeechRecognitionCtor | undefined;
  return ctor ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Speak text via speechSynthesis. Cancels any in-flight utterance first. */
export function speakText(
  text: string,
  opts: { rate?: number; pitch?: number; voiceName?: string; onEnd?: () => void } = {},
): SpeechSynthesisUtterance | null {
  if (!isSpeechSynthesisSupported()) return null;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = opts.rate ?? 1;
  utter.pitch = opts.pitch ?? 1;
  if (opts.voiceName) {
    const v = window.speechSynthesis.getVoices().find((x) => x.name === opts.voiceName);
    if (v) utter.voice = v;
  }
  if (opts.onEnd) utter.onend = opts.onEnd;
  window.speechSynthesis.speak(utter);
  return utter;
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}

/** Stop TTS and report elapsed ms — used by avatar interrupt requirement (<300ms). */
export function interruptSpeech(): number {
  const t0 = performance.now();
  stopSpeaking();
  return Math.round(performance.now() - t0);
}

// ─── Follow-up generation (pure prompt builder; AI call lives server-side) ────

export function buildFollowUpPrompt(params: {
  question: Question;
  answer: string;
  transcriptScore: number;
}): string {
  const { question, answer, transcriptScore } = params;
  return [
    `You are InterViv, a warm interview coach.`,
    `Original question (${question.skill}): ${question.prompt}`,
    `Candidate answer (spoken transcript): ${answer.slice(0, 2000) || "(no answer)"}`,
    `Deterministic concept score: ${transcriptScore}/100. Concepts: ${question.concepts.join(", ") || "n/a"}.`,
    `Write ONE concise follow-up question that probes a gap, asks for a concrete example, or explores a trade-off.`,
    `Do not repeat the original question. Do not score the candidate. Keep under 40 words. Return only the question text.`,
  ].join("\n");
}

export function parseFollowUpResponse(raw: string): string {
  const cleaned = raw
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```$/i, "")
    .trim()
    .replace(/^["“]|["”]$/g, "")
    .trim();
  // Take first non-empty line; fall back to generic probe
  const line =
    cleaned
      .split("\n")
      .map((l) => l.trim())
      .find(Boolean) ?? "";
  if (!line || line.length < 8)
    return "Can you give a concrete example and explain the trade-off you considered?";
  return line.length > 280 ? line.slice(0, 277) + "…" : line;
}

// ─── Scoring & transcript helpers ─────────────────────────────────────────────

export function scoreSpokenAnswer(
  question: Question,
  transcript: string,
): VoiceEntry["score"] extends never ? never : ReturnType<typeof evaluate> {
  return evaluate(question, transcript, null);
}

export function makeVoiceEntry(params: {
  question: Question;
  transcript: string;
  askedAt: string;
  answeredAt: string | null;
  isFollowUp?: boolean;
  parentQuestionId?: string | null;
}): VoiceEntry {
  const result = scoreSpokenAnswer(params.question, params.transcript);
  const durationMs =
    params.answeredAt && params.askedAt
      ? Math.max(0, new Date(params.answeredAt).getTime() - new Date(params.askedAt).getTime())
      : null;
  return {
    id: crypto.randomUUID(),
    questionId: params.question.id,
    questionText: params.question.prompt,
    skill: params.question.skill,
    transcript: params.transcript.trim(),
    score: result.score,
    coverage: result.coverage,
    depth: result.depth,
    clarity: result.clarity,
    askedAt: params.askedAt,
    answeredAt: params.answeredAt,
    durationMs,
    isFollowUp: params.isFollowUp ?? false,
    parentQuestionId: params.parentQuestionId ?? null,
  };
}

export function voiceSessionScore(entries: VoiceEntry[]): number | null {
  if (!entries.length) return null;
  return Math.round(entries.reduce((a, e) => a + e.score, 0) / entries.length);
}

export function formatDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

export function formatClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Words in transcript, ignoring empty tokens. */
export function transcriptWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
