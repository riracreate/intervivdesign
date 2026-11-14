import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Question } from "./data";
import type { ExtractedResume } from "./resume-extractor";
import type { ReviewEntry } from "./spaced-repetition";
export type Result = ReturnType<typeof import("./data").evaluate>;
export type Round = {
  question: Question;
  answer: string;
  selected: number | null;
  result: Result;
  assisted: boolean;
};
export type SessionRecord = {
  id: string;
  title: string;
  mode: string;
  skills: string[];
  rounds: Round[];
  status: string;
  score: number | null;
  created_at: string;
  draft: Record<string, unknown>;
  assisted: boolean;
};
export type CoachPlan = {
  summary: string;
  focusSkills: string[];
  tasks: string[];
  updatedAt: string;
};
export type WorkspaceData = {
  company: string;
  role: string;
  weeklyHours: number;
  bookmarks: string[];
  completed: string[];
  chat: { role: string; text: string }[];
  presets: { name: string; blocks: string[] }[];
  resume: string;
  coachPlan?: CoachPlan | null;
  extractedResume?: ExtractedResume | null;
  reviewSchedule?: ReviewEntry[];
  solvedProblems?: string[];
  completedResources?: string[];
};
const initial: WorkspaceData = {
  company: "Google",
  role: "Software Engineer",
  weeklyHours: 7,
  bookmarks: [],
  completed: [],
  chat: [],
  presets: [],
  resume: "",
  coachPlan: null,
  extractedResume: null,
  reviewSchedule: [],
  solvedProblems: [],
  completedResources: [],
};
const Context = createContext<{
  user: User | null;
  data: WorkspaceData;
  sessions: SessionRecord[];
  ready: boolean;
  sessionsReady: boolean;
  update: (value: Partial<WorkspaceData>) => Promise<void>;
  saveSession: (session: SessionRecord) => Promise<void>;
}>({
  user: null,
  data: initial,
  sessions: [],
  ready: false,
  sessionsReady: false,
  update: async () => {},
  saveSession: async () => {},
});
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState(initial);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [sessionsReady, setSessionsReady] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setUser(data.user);
        setReady(true);
        if (!data.user) setSessionsReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!user) {
      setData(initial);
      setSessions([]);
      setSessionsReady(ready);
      return;
    }
    let active = true;
    setSessionsReady(false);
    Promise.all([
      supabase.from("workspaces").select("data").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("practice_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ])
      .then(([w, s]) => {
        if (!active) return;
        if (w.data) setData({ ...initial, ...(w.data.data as Partial<WorkspaceData>) });
        if (s.data)
          setSessions(
            s.data.map((x) => ({
              ...x,
              rounds: x.rounds as unknown as Round[],
              draft: x.draft as Record<string, unknown>,
            })),
          );
      })
      .finally(() => {
        if (active) setSessionsReady(true);
      });
    return () => {
      active = false;
    };
  }, [user, ready]);
  useEffect(() => {
    const handler = () => supabase.auth.getUser().then(({ data }) => setUser(data.user));
    window.addEventListener("interviv-auth", handler);
    return () => window.removeEventListener("interviv-auth", handler);
  }, []);
  async function update(value: Partial<WorkspaceData>) {
    const next = { ...dataRef.current, ...value };
    dataRef.current = next;
    setData(next);
    if (user) {
      const { error } = await supabase.from("workspaces").upsert({
        user_id: user.id,
        data: JSON.parse(JSON.stringify(next)),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    }
  }
  async function saveSession(session: SessionRecord) {
    if (!user) throw new Error("Sign in to save your practice.");
    const { error } = await supabase.from("practice_sessions").upsert({
      id: session.id,
      user_id: user.id,
      title: session.title,
      mode: session.mode,
      skills: session.skills,
      status: session.status,
      score: session.score,
      rounds: JSON.parse(JSON.stringify(session.rounds)),
      draft: JSON.parse(JSON.stringify(session.draft)),
      assisted: session.assisted,
      created_at: session.created_at,
      completed_at: session.status === "complete" ? new Date().toISOString() : null,
    });
    if (error) throw error;
    setSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)]);
  }
  return (
    <Context.Provider value={{ user, data, sessions, ready, sessionsReady, update, saveSession }}>
      {children}
    </Context.Provider>
  );
}
export const useWorkspace = () => useContext(Context);
