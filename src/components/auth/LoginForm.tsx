"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell, NotConfiguredAlert, isAuthConfigured } from "./AuthShell";
import { safeNext } from "./safe-next";
import styles from "./auth.module.css";

type Status =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "magic-sent"; email: string };

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const urlError = params.get("error");
  const configured = isAuthConfigured();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<"password" | "magic" | null>(null);
  const [status, setStatus] = useState<Status>(urlError ? { kind: "error", message: urlError } : { kind: "idle" });

  async function onPasswordLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!configured || pending) return;
    setPending("password");
    setStatus({ kind: "idle" });
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setStatus({ kind: "error", message: error.message });
        setPending(null);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Please try again." });
      setPending(null);
    }
  }

  async function onMagicLink() {
    if (!configured || pending) return;
    const trimmed = email.trim();
    if (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed)) {
      setStatus({ kind: "error", message: "Enter your email address above to get a magic link." });
      document.getElementById("login-email")?.focus();
      return;
    }
    setPending("magic");
    setStatus({ kind: "idle" });
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) setStatus({ kind: "error", message: error.message });
      else setStatus({ kind: "magic-sent", email: trimmed });
    } catch {
      setStatus({ kind: "error", message: "Couldn’t send the magic link. Please try again." });
    } finally {
      setPending(null);
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Log in to RevenueOS"
      subtitle="Pick up where you left off with your stale deals."
      footer={
        <p className={styles.foot}>
          New here? <Link href="/signup">Create an account</Link>
        </p>
      }
    >
      {!configured ? <NotConfiguredAlert /> : null}

      <div aria-live="polite">
        {status.kind === "error" ? (
          <div className="alert alert--error" role="alert">
            {status.message}
          </div>
        ) : null}
        {status.kind === "magic-sent" ? (
          <div className="alert alert--success" role="status">
            If an account exists for <strong>{status.email}</strong>, a sign-in link is on its way. Check your inbox.
          </div>
        ) : null}
      </div>

      <form className={styles.form} onSubmit={onPasswordLogin}>
        <div className="field">
          <label className="label" htmlFor="login-email">
            Work email
          </label>
          <input
            id="login-email"
            className="input"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            disabled={!configured}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            className="input"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!configured}
          />
        </div>
        <button className="btn btn--primary btn--lg btn--block" type="submit" disabled={!configured || pending !== null}>
          {pending === "password" ? "Logging in…" : "Log in"}
        </button>
      </form>

      <div className={styles.or} aria-hidden="true">
        or
      </div>

      <button
        className="btn btn--block"
        type="button"
        onClick={onMagicLink}
        disabled={!configured || pending !== null}
        aria-describedby="magic-hint"
      >
        {pending === "magic" ? "Sending link…" : "Email me a magic link"}
      </button>
      <span id="magic-hint" className={styles.hint} style={{ marginTop: -12, textAlign: "center" }}>
        Uses the email above. Only works for existing accounts.
      </span>
    </AuthShell>
  );
}
