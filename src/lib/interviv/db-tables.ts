/**
 * Drizzle table definitions for InterViv feature tables.
 *
 * AGENTS.md: do not edit `drizzle/` or `supabase/migrations/` — schema changes
 * go through Lovable. These definitions are the source of truth for the app
 * code; the SQL DDL below must be applied via Lovable → Database before the
 * tables exist in Supabase. Until then the app degrades gracefully (writes
 * fall back to workspace `draft` jsonb / in-memory state).
 */
import { pgTable, uuid, text, integer, timestamp, jsonb, boolean, real } from "drizzle-orm/pg-core";

// ─── Phase 1: voice transcripts ───────────────────────────────────────────────
export const voiceTranscripts = pgTable("voice_transcripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull(),
  userId: uuid("user_id").notNull(),
  questionId: text("question_id").notNull(),
  questionText: text("question_text").notNull(),
  skill: text("skill").notNull().default(""),
  transcript: text("transcript").notNull().default(""),
  score: integer("score").notNull().default(0),
  coverage: integer("coverage").notNull().default(0),
  depth: integer("depth").notNull().default(0),
  clarity: integer("clarity").notNull().default(0),
  isFollowUp: boolean("is_follow_up").notNull().default(false),
  parentQuestionId: text("parent_question_id"),
  askedAt: timestamp("asked_at", { withTimezone: true }).notNull().defaultNow(),
  answeredAt: timestamp("answered_at", { withTimezone: true }),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Phase 2: engagement aggregates (per-question, no raw video) ──────────────
export const engagementStats = pgTable("engagement_stats", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull(),
  userId: uuid("user_id").notNull(),
  questionId: text("question_id").notNull(),
  eyeContactPct: real("eye_contact_pct").notNull().default(0),
  gazeAwayCount: integer("gaze_away_count").notNull().default(0),
  longestGazeAwayMs: integer("longest_gaze_away_ms").notNull().default(0),
  postureScore: real("posture_score").notNull().default(0),
  leftFrame: boolean("left_frame").notNull().default(false),
  extraPerson: boolean("extra_person").notNull().default(false),
  samples: integer("samples").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Phase 4: SM-2 spaced repetition ──────────────────────────────────────────
export const spacedRepetition = pgTable("spaced_repetition", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  topic: text("topic").notNull(),
  nextDue: timestamp("next_due", { withTimezone: true }).notNull().defaultNow(),
  intervalDays: integer("interval_days").notNull().default(1),
  easeFactor: real("ease_factor").notNull().default(2.5),
  repetitions: integer("repetitions").notNull().default(0),
  lastQuality: integer("last_quality"),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── DDL for Lovable (apply via Lovable → Database, not by editing drizzle/) ─
export const DDL_VOICE_TRANSCRIPTS = `
CREATE TABLE IF NOT EXISTS public.voice_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  question_text text NOT NULL,
  skill text NOT NULL DEFAULT '',
  transcript text NOT NULL DEFAULT '',
  score integer NOT NULL DEFAULT 0,
  coverage integer NOT NULL DEFAULT 0,
  depth integer NOT NULL DEFAULT 0,
  clarity integer NOT NULL DEFAULT 0,
  is_follow_up boolean NOT NULL DEFAULT false,
  parent_question_id text,
  asked_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.voice_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own voice transcripts" ON public.voice_transcripts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
`;

export const DDL_ENGAGEMENT_STATS = `
CREATE TABLE IF NOT EXISTS public.engagement_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  eye_contact_pct real NOT NULL DEFAULT 0,
  gaze_away_count integer NOT NULL DEFAULT 0,
  longest_gaze_away_ms integer NOT NULL DEFAULT 0,
  posture_score real NOT NULL DEFAULT 0,
  left_frame boolean NOT NULL DEFAULT false,
  extra_person boolean NOT NULL DEFAULT false,
  samples integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.engagement_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own engagement stats" ON public.engagement_stats
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
`;

export const DDL_SPACED_REPETITION = `
CREATE TABLE IF NOT EXISTS public.spaced_repetition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic text NOT NULL,
  next_due timestamptz NOT NULL DEFAULT now(),
  interval_days integer NOT NULL DEFAULT 1,
  ease_factor real NOT NULL DEFAULT 2.5,
  repetitions integer NOT NULL DEFAULT 0,
  last_quality integer,
  last_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, topic)
);
ALTER TABLE public.spaced_repetition ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own spaced repetition" ON public.spaced_repetition
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
`;
