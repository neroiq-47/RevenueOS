import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import styles from "./marketing.module.css";

type PreviewRow = { name: string; contact: string; amount: string; idle: number; stage: string };

// Illustrative sample data for the product preview only — not real customers.
const sampleRows: PreviewRow[] = [
  { name: "Office fit-out, phase 2", contact: "Sample Co. A", amount: "$48,500", idle: 21, stage: "Quote sent" },
  { name: "Annual maintenance retainer", contact: "Sample Co. B", amount: "$36,000", idle: 12, stage: "Negotiation" },
  { name: "Brand refresh package", contact: "Sample Co. C", amount: "$18,900", idle: 9, stage: "Proposal" },
  { name: "IT onboarding sprint", contact: "Sample Co. D", amount: "$7,200", idle: 15, stage: "Quote sent" },
];

function DashboardPreview() {
  return (
    <figure className={styles.preview} aria-labelledby="preview-caption" style={{ margin: 0 }}>
      <div className={styles.previewBar}>
        <div className={styles.dots} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="badge badge--brand mono">Preview · sample data</span>
      </div>

      <div className={styles.previewStats}>
        <div className={styles.stat}>
          <span className={styles.tag}>Open pipeline</span>
          <span className={styles.statValue}>$214k</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.tag}>Stale 7d+</span>
          <span className={styles.statValue} style={{ color: "var(--warning)" }}>
            4
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.tag}>Drafts left</span>
          <span className={styles.statValue}>87/100</span>
        </div>
      </div>

      <table className={styles.previewTable}>
        <caption className="sr-only">Sample stale opportunities, sorted by amount then days inactive</caption>
        <thead>
          <tr>
            <th scope="col">Opportunity</th>
            <th scope="col">Amount</th>
            <th scope="col">Idle</th>
            <th scope="col" className={styles.hideSm}>
              Stage
            </th>
          </tr>
        </thead>
        <tbody>
          {sampleRows.map((r) => (
            <tr key={r.name}>
              <td>
                <span className={styles.dealName}>{r.name}</span>
                <span className={styles.dealSub}>{r.contact}</span>
              </td>
              <td className={styles.amount}>{r.amount}</td>
              <td>
                <span className={`badge ${r.idle >= 14 ? "badge--danger" : "badge--warning"} mono`}>{r.idle}d</span>
              </td>
              <td className={styles.hideSm}>
                <span className="muted" style={{ fontSize: 13 }}>
                  {r.stage}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <figcaption id="preview-caption" className={styles.previewFoot}>
        <span>Illustrative preview — rows are made up</span>
        <span>sort: amount ↓, idle ↓</span>
      </figcaption>
    </figure>
  );
}

export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className="glow glow--blue" style={{ width: 520, height: 520, top: -160, left: -180 }} aria-hidden="true" />
      <div className="glow glow--violet" style={{ width: 420, height: 420, top: 80, right: -160, opacity: 0.35 }} aria-hidden="true" />
      <div className="container">
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <span className="eyebrow">
              <span className="dot" aria-hidden="true" />
              Stale-deal recovery for service firms
            </span>
            <h1 id="hero-title" className={styles.h1}>
              Turn overdue quotes into <span className="gradient-text">recovered revenue.</span>
            </h1>
            <p className={styles.heroLead}>
              Upload your open opportunities, see which deals have gone quiet for 7+ days, and get AI-drafted
              follow-ups you review, copy and send yourself. RevenueOS never emails anyone on your behalf.
            </p>
            <div className={styles.heroCtas}>
              <Link href="/signup" className="btn btn--primary btn--lg">
                Start recovering
              </Link>
              <a href="#how-it-works" className="btn btn--lg">
                See how it works
              </a>
            </div>
            <ul className={styles.heroMeta}>
              <li>$499 / org / month</li>
              <li>CSV import</li>
              <li>Cancel anytime</li>
            </ul>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.markStage} aria-hidden="true">
              <div className={styles.markRing} />
              <LogoMark size={160} className={styles.mark} />
            </div>
            <DashboardPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
