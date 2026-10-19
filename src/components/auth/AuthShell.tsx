import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import styles from "./auth.module.css";

/** Shared glass-card layout for login / signup. */
export function AuthShell({
  title,
  subtitle,
  eyebrow,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className={`bg-grid ${styles.page}`}>
      <div className="glow glow--blue" style={{ width: 460, height: 460, top: -200, left: "50%", marginLeft: -380 }} aria-hidden="true" />
      <div className="glow glow--violet" style={{ width: 360, height: 360, bottom: -120, right: -120, opacity: 0.3 }} aria-hidden="true" />
      <header className={`container ${styles.top}`}>
        <Logo size={26} />
        <Link href="/" className="btn btn--sm btn--ghost">
          ← Back to site
        </Link>
      </header>
      <main className={`container ${styles.main}`}>
        <section className={`card card--glow ${styles.card}`} aria-labelledby="auth-title">
          <div className={styles.head}>
            {eyebrow ? (
              <span className="eyebrow">
                <span className="dot" aria-hidden="true" />
                {eyebrow}
              </span>
            ) : null}
            <h1 id="auth-title" className={styles.title}>
              {title}
            </h1>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
          {children}
          {footer}
        </section>
      </main>
      <p className={styles.bottom}>AI drafts are suggestions · RevenueOS never sends email for you</p>
    </div>
  );
}

export function NotConfiguredAlert() {
  return (
    <div className="alert alert--info" role="status">
      Authentication isn’t configured in this environment yet. Set <span className="mono">NEXT_PUBLIC_SUPABASE_URL</span>{" "}
      and <span className="mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</span> to enable sign-in.
    </div>
  );
}

export function isAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
