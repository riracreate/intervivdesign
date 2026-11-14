import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/interviv/workspace";
import { askCoach } from "@/lib/interviv/coach.functions";
import { Sparkles, ArrowRight, AuthPrompt } from "./ui";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
export function Coach() {
  const { user, data, update } = useWorkspace();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("goal");
  const ask = useServerFn(askCoach);
  async function send() {
    if (!user) {
      toast.info("Sign in to talk with your coach.");
      return;
    }
    if (input.trim().length < 20) {
      toast.info(
        "Tell me a little more: your role, experience, and the skills you want to work on.",
      );
      return;
    }
    setBusy(true);
    try {
      const message = input;
      const result = await ask({ data: { message, role: data.role, hours: data.weeklyHours } });
      await update({
        chat: [...data.chat, { role: "You", text: message }, { role: "Coach", text: result.text }],
      });
      setInput("");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Your coach is unavailable. Your message is still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="coach-intro">
        <span className="icon-box">
          <Sparkles size={28} />
        </span>
        <div className="eyebrow">A nudge in the right direction</div>
        <h1>You don’t have to figure it all out alone.</h1>
        <p>Bring a goal, a question, or a little uncertainty. Let’s turn it into a next step.</p>
      </div>
      <div className="chat-area">
        {!user && <AuthPrompt />}
        <div className="grid-three mb-6">
          {[
            "I’m not sure where to start with interview preparation.",
            "I want to get better at coding and data structures.",
            "Help me work on my gaps for a software engineering role.",
          ].map((t) => (
            <Button
              key={t}
              variant="outline"
              className="h-auto whitespace-normal py-5 text-left"
              onClick={() => setInput(t)}
            >
              {t}
              <ArrowRight />
            </Button>
          ))}
        </div>
        {data.chat.map((m, i) => (
          <div key={i} className={`chat-message ${m.role === "Coach" ? "coach" : ""}`}>
            <strong>{m.role}</strong>
            {m.text}
          </div>
        ))}
        <section className="panel form-stack">
          <div className="row between">
            <div className="chip-group">
              <Button
                variant={kind === "goal" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setKind("goal")}
              >
                I have a goal
              </Button>
              <Button
                variant={kind === "jd" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setKind("jd")}
              >
                I have a job description
              </Button>
            </div>
            <span className="tiny text-muted">{data.weeklyHours} hrs / week</span>
          </div>
          <label>
            {kind === "goal" ? "What’s on your mind?" : "Your job description"}
            <textarea
              maxLength={8000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                kind === "goal"
                  ? "I’m preparing for a backend engineering role. I know Python, but I struggle with system design…"
                  : "Paste the job description here…"
              }
            />
          </label>
          <div className="row between">
            <Button variant="link" asChild>
              <Link to="/roadmap">
                Open my roadmap <ArrowRight />
              </Link>
            </Button>
            <Button disabled={busy} onClick={send}>
              {busy ? "Thinking it through…" : "Find my next step"}
              <Sparkles />
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
