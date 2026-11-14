import { useState, useEffect } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { validPassword } from "@/lib/interviv/data";
import { Brand, ArrowRight } from "./ui";
export function Auth({
  initialSignup = false,
  reset = false,
}: {
  initialSignup?: boolean;
  reset?: boolean;
}) {
  const [signup, setSignup] = useState(initialSignup);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const nav = useNavigate();
  useEffect(() => {
    if (reset) {
      setRecovery(
        window.location.hash.includes("type=recovery") ||
          window.location.search.includes("type=recovery"),
      );
    } else
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) nav({ to: "/" });
      });
  }, [reset]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (reset) {
        if (!recovery)
          throw new Error("Open the recovery link from your email to reset your password.");
        if (!validPassword(password))
          throw new Error("Use at least 8 characters, one letter and one number.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage("Your password is updated.");
        return;
      }
      if (signup) {
        if (!validPassword(password))
          throw new Error("Use at least 8 characters, one letter and one number.");
        if (password !== confirm) throw new Error("Your passwords do not match.");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMessage(
          "Check your email to confirm your account. You’re not signed in until you confirm.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.dispatchEvent(new Event("interviv-auth"));
        await nav({ to: "/" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  async function social(provider: "google" | "lovable") {
    setError("");
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (!result.redirected) {
      window.dispatchEvent(new Event("interviv-auth"));
      nav({ to: "/" });
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Brand />
        <h1>
          {reset
            ? "A fresh password. A fresh start."
            : signup
              ? "Your next chapter starts here."
              : "Welcome back. Let’s keep growing."}
        </h1>
        <p>
          {reset
            ? "Choose a strong new password."
            : "A little practice today. A little more confidence tomorrow."}
        </p>
        <form className="form-stack" onSubmit={submit}>
          {signup && !reset && (
            <label>
              Your name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>
          )}
          {!reset && (
            <label>
              Email
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
          )}
          <label>
            Password
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={signup || reset ? "new-password" : "current-password"}
            />
          </label>
          {signup && !reset && (
            <label>
              Confirm password
              <input
                required
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </label>
          )}
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
          <Button disabled={busy || (reset && !recovery)} type="submit">
            {busy
              ? "One moment…"
              : reset
                ? "Set new password"
                : signup
                  ? "Create my account"
                  : "Sign in"}
            <ArrowRight />
          </Button>
          {!signup && !reset && (
            <Button
              type="button"
              variant="link"
              onClick={async () => {
                if (!email) {
                  setError("Enter your email first.");
                  return;
                }
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) setError(error.message);
                else setMessage("Check your email for a password reset link.");
              }}
            >
              Forgot your password?
            </Button>
          )}
        </form>
        {!reset && (
          <div className="form-stack mt-5">
            <Button className="google-button" variant="outline" onClick={() => social("google")}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                />
              </svg>
              Continue with Google
            </Button>
            <Button
              className="lovable-auth-button"
              variant="outline"
              onClick={() => social("lovable")}
            >
              Continue with Lovable
            </Button>
            <Button
              variant="link"
              onClick={() => {
                setSignup(!signup);
                setError("");
                setMessage("");
              }}
            >
              {signup ? "Already have an account? Sign in" : "New here? Create an account"}
            </Button>
            <Link to="/" className="text-link mx-auto">
              Explore workspace <ArrowRight />
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
