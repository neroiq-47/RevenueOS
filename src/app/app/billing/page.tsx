import type { Metadata } from "next";
import { requireOrg } from "@/lib/org";
import { serverEnv } from "@/lib/env";
import { monthlyUsage } from "@/lib/usage";
import styles from "./billing.module.css";

export const metadata: Metadata = { title: "Billing · RevenueOS" };
export const dynamic = "force-dynamic";

function inclusions(draftQuota: number): string[] {
  return [
    "Unlimited contacts and opportunities",
    "CSV import with validation",
    "Stale-deal radar ranked by value",
    `AI follow-up drafts (${draftQuota} per month)`,
    "Data export and deletion anytime",
  ];
}

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  active: { label: "Active", tone: "badge--success" },
  trialing: { label: "Trialing", tone: "badge--success" },
  past_due: { label: "Payment past due", tone: "badge--warning" },
  unpaid: { label: "Unpaid", tone: "badge--danger" },
  canceled: { label: "Cancelled", tone: "badge--danger" },
  incomplete: { label: "Incomplete", tone: "badge--warning" },
  incomplete_expired: { label: "Expired", tone: "badge--danger" },
  paused: { label: "Paused", tone: "badge--warning" },
};

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireOrg();
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : undefined;

  const sub = ctx.subscription;
  const hasCustomer = Boolean(sub?.stripe_customer_id);
  const statusInfo = sub
    ? (STATUS_LABELS[sub.status] ?? { label: sub.status, tone: "" })
    : { label: "No subscription", tone: "badge--warning" };
  const periodEnd = formatDate(sub?.current_period_end);
  const quota = serverEnv.aiDraftsPerMonth();

  let draftsUsed: number | null = null;
  if (ctx.entitled) {
    try {
      draftsUsed = await monthlyUsage(ctx, "draft");
    } catch {
      draftsUsed = null;
    }
  }

  let dateLine: string | null = null;
  if (periodEnd) {
    if (ctx.entitled) dateLine = `Current period renews or ends on ${periodEnd}`;
    else if (sub?.status === "canceled") dateLine = `Access ended on ${periodEnd}`;
    else dateLine = `Billing period ends ${periodEnd}`;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className="eyebrow">
          <span className="dot" /> Billing
        </span>
        <h1 className={styles.title}>
          Your <span className="gradient-text">plan</span>
        </h1>
        <p className="muted">One simple plan per organisation. Cancel anytime from the billing portal.</p>
      </header>

      {status === "success" &&
        (ctx.entitled ? (
          <div className="alert alert--success" role="status">
            You&apos;re subscribed. All features are unlocked.
          </div>
        ) : (
          <div className="alert alert--info" role="status">
            Payment received — activating your subscription. Refresh in a few seconds.
          </div>
        ))}
      {status === "cancelled" && (
        <div className="alert" role="status">
          Checkout was cancelled. You haven&apos;t been charged.
        </div>
      )}
      {status === "error" && (
        <div className="alert alert--error" role="alert">
          We couldn&apos;t reach the billing provider. Please try again in a moment.
        </div>
      )}
      {!ctx.entitled && sub && (sub.status === "past_due" || sub.status === "unpaid") && (
        <div className="alert alert--error" role="alert">
          Your last payment failed. Update your payment method in the billing portal to restore access.
        </div>
      )}

      <div className={styles.grid}>
        <section className={`card card--pad card--glow ${styles.plan}`} aria-labelledby="plan-name">
          <div className="row row--between row--wrap">
            <h2 id="plan-name" className={styles.planName}>
              RevenueOS Lite
            </h2>
            <span className={`badge ${statusInfo.tone}`}>{statusInfo.label}</span>
          </div>
          <p className={styles.price}>
            <span className={styles.amount}>$499</span>
            <span className="muted"> / organisation / month</span>
          </p>
          <ul className={styles.list}>
            {inclusions(quota).map((item) => (
              <li key={item}>
                <span className={styles.check} aria-hidden="true">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>

          {ctx.entitled || hasCustomer ? (
            <div className="stack">
              {!ctx.entitled && (
                <form action="/api/stripe/checkout" method="post">
                  <button type="submit" className="btn btn--primary btn--block">
                    Resubscribe — $499/month
                  </button>
                </form>
              )}
              <form action="/api/stripe/portal" method="post">
                <button type="submit" className={`btn btn--block ${ctx.entitled ? "btn--primary" : ""}`}>
                  Manage billing
                </button>
              </form>
            </div>
          ) : (
            <form action="/api/stripe/checkout" method="post">
              <button type="submit" className="btn btn--primary btn--lg btn--block">
                Subscribe — $499/month
              </button>
            </form>
          )}
          <p className={`subtle ${styles.fine}`}>
            Secure checkout by Stripe. Prices exclude applicable taxes. Invoices and cancellation are in the billing portal.
          </p>
        </section>

        <aside className="stack">
          <section className="card card--pad">
            <h3 className={styles.sideTitle}>Subscription</h3>
            <dl className={styles.facts}>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={`badge ${statusInfo.tone}`}>{statusInfo.label}</span>
                </dd>
              </div>
              <div>
                <dt>Organisation</dt>
                <dd>{ctx.org.name}</dd>
              </div>
              {dateLine && (
                <div>
                  <dt>Period</dt>
                  <dd>{dateLine}</dd>
                </div>
              )}
            </dl>
          </section>

          {ctx.entitled && (
            <section className="card card--pad">
              <h3 className={styles.sideTitle}>AI drafts this month</h3>
              {draftsUsed === null ? (
                <p className="muted">Usage is unavailable right now.</p>
              ) : (
                <>
                  <p className={styles.usage}>
                    <span className="mono">{draftsUsed}</span>
                    <span className="muted"> / {quota} used</span>
                  </p>
                  <div
                    className={styles.meter}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={quota}
                    aria-valuenow={Math.min(draftsUsed, quota)}
                    aria-label="AI drafts used this month"
                  >
                    <span style={{ width: `${Math.min(100, quota > 0 ? (draftsUsed / quota) * 100 : 100)}%` }} />
                  </div>
                  <p className="subtle">Resets on the 1st of each month (UTC).</p>
                </>
              )}
            </section>
          )}

          {!ctx.entitled && (
            <section className="card card--pad">
              <h3 className={styles.sideTitle}>Your data is safe</h3>
              <p className="muted">
                Without an active subscription you can still view, export and delete your data from the Account page.
                Importing and AI drafts need an active plan.
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
