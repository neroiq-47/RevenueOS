"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell, NotConfiguredAlert, isAuthConfigured } from "./AuthShell";
import styles from "./auth.module.css";

const MIN_PASSWORD = 8;

export function SignupForm() {
  const router = useRouter();
  const configured = isAuthConfigured();

  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!configured || pending) return;

    const companyName = company.trim();
    const trimmedEmail = email.trim();
    if (!companyName) return setError("Enter your company name.");
    if (password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`);

    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: { company: companyName },
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/app/billing`,
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (data.session) {
        // Email confirmation is disabled for this project: the user is already signed in.
        router.replace("/app/billing");
        router.refresh();
        return;
      }
      setSentTo(trimmedEmail);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (sentTo) {
    return (
      <AuthShell
        eyebrow="Almost there"
        title="Check your email"
        footer={
          <p className={styles.foot}>
            Already confirmed? <Link href="/login">Log in</Link>
          </p>
        }
      >
        <div className={styles.sent} role="status" aria-live="polite">
          <span className={styles.sentIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </span>
          <p className="muted" style={{ margin: 0 }}>
            We sent a confirmation link to <strong style={{ color: "var(--text)" }}>{sentTo}</strong>. Open it to verify
            your email, then you’ll be taken to subscribe.
          </p>
          <p className={styles.hint} style={{ margin: 0 }}>
            Didn’t get it? Check spam, or{" "}
            <button type="button" className={styles.linkButton} onClick={() => setSentTo(null)}>
              try a different email
            </button>
            .
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="$499 / org / month"
      title="Create your account"
      subtitle="Set up your organisation, verify your email, then subscribe to start recovering stale deals."
      footer={
        <>
          <p className={styles.foot}>
            Already have an account? <Link href="/login">Log in</Link>
          </p>
          <p className={styles.legal}>
            By signing up you agree to the <Link href="/terms">Terms</Link> and{" "}
            <Link href="/privacy">Privacy notice</Link>.
          </p>
        </>
      }
    >
      {!configured ? <NotConfiguredAlert /> : null}

      <div aria-live="polite">
        {error ? (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        ) : null}
      </div>

      <form className={styles.form} onSubmit={onSubmit}>
        <div className="field">
          <label className="label" htmlFor="signup-company">
            Company name
          </label>
          <input
            id="signup-company"
            className="input"
            type="text"
            name="company"
            autoComplete="organization"
            required
            maxLength={120}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Acme Services Ltd"
            disabled={!configured}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="signup-email">
            Work email
          </label>
          <input
            id="signup-email"
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
          <label className="label" htmlFor="signup-password">
            Password
          </label>
          <input
            id="signup-password"
            className="input"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD}
            aria-describedby="signup-password-hint"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!configured}
          />
          <span id="signup-password-hint" className={styles.hint}>
            At least {MIN_PASSWORD} characters.
          </span>
        </div>
        <button className="btn btn--primary btn--lg btn--block" type="submit" disabled={!configured || pending}>
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
