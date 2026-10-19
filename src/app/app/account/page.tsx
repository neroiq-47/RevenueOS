import type { Metadata } from "next";
import { requireOrg } from "@/lib/org";
import { DeleteDataForm } from "./DeleteDataForm";
import styles from "./account.module.css";

export const metadata: Metadata = { title: "Account · RevenueOS" };
export const dynamic = "force-dynamic";

const PRIVACY_EMAIL = "privacy@revenueos.example";

export default async function AccountPage() {
  const ctx = await requireOrg();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className="eyebrow">
          <span className="dot" /> Account
        </span>
        <h1 className={styles.title}>
          Account &amp; <span className="gradient-text">data</span>
        </h1>
        <p className="muted">Your data belongs to you. Export it or delete it at any time.</p>
      </header>

      <section className="card card--pad" aria-labelledby="org-heading">
        <h2 id="org-heading" className={styles.sectionTitle}>
          Organisation
        </h2>
        <dl className={styles.facts}>
          <div>
            <dt>Name</dt>
            <dd>{ctx.org.name}</dd>
          </div>
          <div>
            <dt>Owner email</dt>
            <dd className="mono">{ctx.email}</dd>
          </div>
          <div>
            <dt>Plan</dt>
            <dd>
              <span className={`badge ${ctx.entitled ? "badge--success" : "badge--warning"}`}>
                {ctx.entitled ? "Active" : "No active subscription"}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="card card--pad" aria-labelledby="export-heading">
        <div className={styles.split}>
          <div>
            <h2 id="export-heading" className={styles.sectionTitle}>
              Export my data
            </h2>
            <p className="muted">
              Download your organisation, subscription status, contacts, opportunities and AI drafts as a JSON file.
            </p>
          </div>
          <a className="btn" href="/api/account/export" download>
            Export my data
          </a>
        </div>
      </section>

      <section className={`card card--pad ${styles.danger}`} aria-labelledby="danger-heading">
        <h2 id="danger-heading" className={styles.sectionTitle}>
          Danger zone
        </h2>
        <p className="muted">
          Permanently delete all contacts, opportunities and AI drafts for <strong>{ctx.org.name}</strong>. This cannot be
          undone. Your login and subscription are not affected — cancel billing from the Billing page.
        </p>
        <DeleteDataForm />
        <hr className="divider" />
        <p className="subtle">
          To close your account entirely (including your login and organisation), email{" "}
          <a className={styles.link} href={`mailto:${PRIVACY_EMAIL}?subject=Account%20closure`}>
            {PRIVACY_EMAIL}
          </a>{" "}
          from your owner email address. During the pilot we process closure requests manually.
        </p>
      </section>
    </div>
  );
}
