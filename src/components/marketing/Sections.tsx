import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./marketing.module.css";

/* ---------------- Icons (inline, decorative) ---------------- */

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const icons = {
  upload: (
    <Icon>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 20h16" />
    </Icon>
  ),
  radar: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12 18 6" />
      <circle cx="12" cy="12" r="4" />
    </Icon>
  ),
  spark: (
    <Icon>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
    </Icon>
  ),
  copy: (
    <Icon>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </Icon>
  ),
  chart: (
    <Icon>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Icon>
  ),
  flag: (
    <Icon>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </Icon>
  ),
  shield: (
    <Icon>
      <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />
    </Icon>
  ),
  card: (
    <Icon>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </Icon>
  ),
  hand: (
    <Icon>
      <path d="M4 12h16" />
      <path d="m14 6 6 6-6 6" />
    </Icon>
  ),
  box: (
    <Icon>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </Icon>
  ),
};

function Check() {
  return (
    <span className={styles.check} aria-hidden="true">
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m2.5 6.2 2.3 2.3L9.5 3.8" />
      </svg>
    </span>
  );
}

/* ---------------- Marquee ---------------- */

const capabilities = [
  "CSV import",
  "Stale detection · 7-day rule",
  "Sorted by amount, then inactivity",
  "AI follow-up drafts",
  "Copy, never auto-send",
  "Mark won or lost",
  "Pipeline at a glance",
  "Row-level tenant isolation",
  "Stripe-secured billing",
  "Export & delete your data",
];

export function Marquee() {
  return (
    <div className={styles.marquee} role="region" aria-label="Capabilities">
      <div className={styles.marqueeTrack}>
        <ul className={styles.marqueeGroup}>
          {capabilities.map((c) => (
            <li key={c} className={styles.marqueeItem}>
              {c}
            </li>
          ))}
        </ul>
        <ul className={styles.marqueeGroup} aria-hidden="true">
          {capabilities.map((c) => (
            <li key={c} className={styles.marqueeItem}>
              {c}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------------- How it works ---------------- */

const steps = [
  { title: "Sign up & subscribe", body: "Create your organisation, verify your email, and subscribe through Stripe’s hosted checkout." },
  { title: "Upload a CSV", body: "Import open opportunities from any CRM or spreadsheet export: deal, contact, amount, last activity." },
  { title: "Spot stale deals", body: "Open deals with no activity for 7+ days rise to the top, biggest amounts first." },
  { title: "Generate a draft", body: "Get an AI-suggested follow-up based on the deal details. Edit it until it sounds like you." },
  { title: "Send & mark outcome", body: "Copy the approved draft into your own email, send it, then mark the deal won, lost or still open." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className={styles.section} aria-labelledby="how-title">
      <div className="container">
        <div className={styles.sectionHead}>
          <span className={styles.tag}>// how it works</span>
          <h2 id="how-title" className={styles.h2}>
            From spreadsheet to sent follow-up in <span className="gradient-text">five steps.</span>
          </h2>
        </div>
        <ol className={styles.steps}>
          {steps.map((s, i) => (
            <li key={s.title} className={`card ${styles.step}`}>
              <span className={styles.stepNum}>STEP_0{i + 1}</span>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepBody}>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------------- Features ---------------- */

const features = [
  { icon: icons.upload, title: "CSV import", body: "Bring opportunities from wherever they live today. No CRM migration, no integrations to set up." },
  { icon: icons.radar, title: "Stale-deal detection", body: "A clear, predictable rule flags open deals that have gone quiet, ranked by what’s most worth chasing." },
  { icon: icons.spark, title: "AI follow-up drafts", body: "Context-aware drafts written from the opportunity details. 100 drafts per organisation each month." },
  { icon: icons.copy, title: "You stay in control", body: "Review, edit and copy. RevenueOS never sends email for you — every message goes out from your own inbox." },
  { icon: icons.chart, title: "Pipeline at a glance", body: "See open value, stale count and outcomes on one dashboard instead of scrolling a spreadsheet." },
  { icon: icons.flag, title: "Mark outcomes", body: "Record won, lost or still-open so the stale list stays honest and your next follow-up is obvious." },
];

export function Features() {
  return (
    <section id="features" className={styles.section} aria-labelledby="features-title">
      <div className="container">
        <div className={styles.sectionHead}>
          <span className={styles.tag}>// features</span>
          <h2 id="features-title" className={styles.h2}>
            Everything you need to chase quotes. <span className="gradient-text">Nothing you don’t.</span>
          </h2>
          <p className={styles.lead}>
            Built for B2B service firms whose revenue leaks through quotes nobody followed up on.
          </p>
        </div>
        <div className={styles.features}>
          {features.map((f) => (
            <article key={f.title} className={`card ${styles.feature}`}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureBody}>{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Stale-deal rule ---------------- */

export function StaleRule() {
  const days = [1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <section className={styles.section} aria-labelledby="rule-title" style={{ paddingTop: 0 }}>
      <div className="container">
        <div className={`card card--glow ${styles.rule}`}>
          <div className="stack" style={{ gap: 18 }}>
            <span className={styles.tag}>// the stale-deal rule</span>
            <h2 id="rule-title" className={styles.h2} style={{ fontSize: "clamp(26px, 3.6vw, 36px)" }}>
              Quiet for 7 days? <span className="gradient-text">It’s stale.</span>
            </h2>
            <ul className={styles.ruleList}>
              <li>Only open deals count — won and lost deals are never flagged.</li>
              <li>Inactivity is measured from the deal’s last recorded activity.</li>
              <li>Stale deals are sorted by amount, then by days inactive, so the biggest risks come first.</li>
            </ul>
            <div>
              <div className={styles.timeline} role="img" aria-label="Timeline: days 1 to 6 active, day 7 and later flagged stale">
                {days.map((d) => (
                  <span key={d} className={d >= 7 ? styles.tickStale : d === 1 ? styles.tickActive : styles.tick}>
                    d{d}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <pre className={styles.ruleCode}>
            <span className={styles.cm}>{"// what RevenueOS checks\n"}</span>
            <span className={styles.kw}>stale</span>
            {" = deal.stage == "}
            <span className={styles.str}>{'"open"'}</span>
            {"\n     && daysSince(deal.last_activity) >= "}
            <span className={styles.num}>7</span>
            {"\n\n"}
            <span className={styles.kw}>sort</span>
            {" by amount "}
            <span className={styles.kw}>desc</span>
            {",\n     daysInactive "}
            <span className={styles.kw}>desc</span>
          </pre>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Trust ---------------- */

const trustItems = [
  { icon: icons.shield, title: "Row-level tenant isolation", body: "Database row-level security scopes every query to your organisation. Other tenants can’t see your deals." },
  { icon: icons.hand, title: "AI never sends on your behalf", body: "Drafts are suggestions. Nothing leaves RevenueOS unless you copy it and send it yourself." },
  { icon: icons.card, title: "Stripe-secured billing", body: "Payments run through Stripe’s hosted checkout and billing portal. We never see or store card numbers." },
  { icon: icons.box, title: "Your data, exportable and deletable", body: "Export your opportunities or delete your organisation’s data from the Account page." },
];

export function Trust() {
  return (
    <section className={styles.section} aria-labelledby="trust-title">
      <div className="container">
        <div className={styles.sectionHead}>
          <span className={styles.tag}>// security & trust</span>
          <h2 id="trust-title" className={styles.h2}>
            Your pipeline, <span className="gradient-text">kept yours.</span>
          </h2>
          <p className={styles.lead}>
            Plain commitments about how RevenueOS handles your data. Read the{" "}
            <Link href="/privacy" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
              privacy notice
            </Link>{" "}
            for the details.
          </p>
        </div>
        <div className={styles.trust}>
          {trustItems.map((t) => (
            <article key={t.title} className={`card ${styles.trustItem}`}>
              <span className={styles.featureIcon}>{t.icon}</span>
              <h3 className={styles.trustTitle}>{t.title}</h3>
              <p className={styles.trustBody}>{t.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Pricing ---------------- */

const included = [
  "CSV import of open opportunities",
  "Stale-deal detection (7-day rule)",
  "100 AI follow-up drafts per month",
  "Pipeline dashboard & outcome tracking",
  "Self-serve billing portal — cancel anytime",
];

export function Pricing() {
  return (
    <section id="pricing" className={styles.section} aria-labelledby="pricing-title">
      <div className="glow glow--cyan" style={{ width: 380, height: 380, left: "50%", top: "30%", marginLeft: -190, opacity: 0.18 }} aria-hidden="true" />
      <div className="container">
        <div className={styles.sectionHeadCenter}>
          <span className={styles.tag}>// pricing</span>
          <h2 id="pricing-title" className={styles.h2}>
            One plan. <span className="gradient-text">One price.</span>
          </h2>
          <p className={styles.lead}>Per organisation, not per seat. One owner account per organisation.</p>
        </div>
        <div className={styles.pricingWrap}>
          <div className={`card card--glow ${styles.priceCard}`}>
            <div className={styles.priceHead}>
              <h3 style={{ fontSize: 20 }}>RevenueOS Lite</h3>
              <span className="badge badge--brand mono">monthly</span>
            </div>
            <p className={styles.price} style={{ margin: 0 }}>
              <span className={styles.priceAmount}>$499</span>
              <span className={styles.priceUnit}>per organisation / month</span>
            </p>
            <ul className={styles.included} aria-label="What’s included">
              {included.map((item) => (
                <li key={item}>
                  <Check />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link href="/signup" className="btn btn--primary btn--lg btn--block">
              Start recovering
            </Link>
            <p className={styles.fine}>Billed via Stripe hosted checkout. Cancel anytime from the billing portal.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */

const faqs: { q: string; a: ReactNode }[] = [
  {
    q: "Does RevenueOS send emails for me?",
    a: "No. RevenueOS generates a suggested draft. You review it, edit it, copy it and send it from your own email client. Nothing is ever sent on your behalf.",
  },
  {
    q: "What counts as a stale deal?",
    a: "An open opportunity with no recorded activity for 7 or more days. Stale deals are listed by amount first, then by how long they’ve been inactive.",
  },
  {
    q: "What does my CSV need to contain?",
    a: "One row per opportunity, with columns such as deal name, contact name and email, amount, stage and last activity date. You can export this from most CRMs or keep it in a spreadsheet.",
  },
  {
    q: "What data is sent to the AI model?",
    a: "Only the details of the opportunity you’re drafting for (for example deal name, contact, amount, stage and how long it’s been quiet). Drafts are generated only when you ask for one.",
  },
  {
    q: "What happens after 100 drafts in a month?",
    a: "Draft generation pauses until your monthly allowance resets. Importing, stale detection and the dashboard keep working.",
  },
  {
    q: "Can I cancel?",
    a: "Yes, anytime, from the Stripe billing portal linked on your Billing page. There’s no contract or minimum term.",
  },
  {
    q: "Can I get my data out or delete it?",
    a: "Yes. The Account page lets you export your opportunities and delete your organisation’s data.",
  },
];

export function Faq() {
  return (
    <section id="faq" className={styles.section} aria-labelledby="faq-title">
      <div className="container">
        <div className={styles.sectionHeadCenter}>
          <span className={styles.tag}>// faq</span>
          <h2 id="faq-title" className={styles.h2}>
            Questions, <span className="gradient-text">answered.</span>
          </h2>
        </div>
        <div className={styles.faq}>
          {faqs.map((f) => (
            <details key={f.q} className={styles.faqItem}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Final CTA ---------------- */

export function FinalCta() {
  return (
    <section className={styles.section} aria-labelledby="final-title" style={{ paddingTop: 0 }}>
      <div className="container">
        <div className={`card card--glow bg-grid ${styles.final}`}>
          <div className="glow glow--blue" style={{ width: 360, height: 360, top: -180, left: "50%", marginLeft: -180, opacity: 0.4 }} aria-hidden="true" />
          <span className="eyebrow">
            <span className="dot" aria-hidden="true" />
            Your quotes are waiting
          </span>
          <h2 id="final-title" className={styles.h2} style={{ maxWidth: 640 }}>
            Follow up on the deals <span className="gradient-text">you already won the hard part of.</span>
          </h2>
          <p className={styles.lead} style={{ maxWidth: 520 }}>
            Upload a CSV and see your stale opportunities in minutes.
          </p>
          <div className="row row--wrap" style={{ justifyContent: "center" }}>
            <Link href="/signup" className="btn btn--primary btn--lg">
              Start recovering
            </Link>
            <Link href="/login" className="btn btn--lg">
              Log in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
