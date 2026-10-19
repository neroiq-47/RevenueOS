import type { Metadata } from "next";
import { requireEntitledOrg } from "@/lib/org";
import { MAX_ROWS } from "@/lib/csv";
import { ImportForm } from "./ImportForm";
import styles from "./import.module.css";

export const metadata: Metadata = { title: "Import CSV · RevenueOS" };
export const dynamic = "force-dynamic";

const COLUMNS: { name: string; required: boolean; aliases: string; example: string; notes: string }[] = [
  { name: "title", required: true, aliases: "deal, quote, opportunity", example: "Website redesign", notes: "1–200 characters" },
  { name: "contact_name", required: true, aliases: "contact, name", example: "Maya Chen", notes: "1–200 characters" },
  { name: "contact_email", required: true, aliases: "email, email_address", example: "maya@northwind.com", notes: "Valid email address" },
  { name: "amount", required: true, aliases: "value, deal_value", example: "$12,500.00", notes: "Non-negative; symbols and commas OK" },
  { name: "last_activity_at", required: true, aliases: "last_activity, last_contacted", example: "2026-10-05", notes: "YYYY-MM-DD or ISO date-time, not in the future" },
  { name: "currency", required: false, aliases: "currency_code", example: "USD", notes: "3-letter code; defaults to USD" },
  { name: "stage", required: false, aliases: "status", example: "open", notes: "open, won or lost; defaults to open" },
];

export default async function ImportPage() {
  await requireEntitledOrg();

  return (
    <div className={styles.page}>
      <header>
        <span className="eyebrow">
          <span className="dot" /> Data
        </span>
        <h1 className={styles.title}>Import opportunities</h1>
        <p className="muted" style={{ margin: "8px 0 0", maxWidth: 640 }}>
          Upload a CSV of your quotes and deals. Every row is checked first: if anything is wrong, nothing is imported and
          you&apos;ll see exactly which rows to fix.
        </p>
      </header>

      <ImportForm />

      <section className={`card ${styles.columns}`} aria-labelledby="columns-heading">
        <div className={styles.columnsHead}>
          <div>
            <h2 id="columns-heading" className={styles.h2}>
              Expected columns
            </h2>
            <p className="subtle" style={{ margin: "4px 0 0", fontSize: 13 }}>
              Header names are case-insensitive. Up to {MAX_ROWS.toLocaleString("en-US")} rows and 1 MB per file. Extra
              columns are ignored.
            </p>
          </div>
          <a href="/sample-opportunities.csv" download className="btn btn--sm">
            Download sample CSV
          </a>
        </div>
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">CSV columns accepted by the importer</caption>
            <thead>
              <tr>
                <th scope="col">Column</th>
                <th scope="col">Required</th>
                <th scope="col">Also accepted</th>
                <th scope="col">Example</th>
                <th scope="col">Rules</th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map((c) => (
                <tr key={c.name}>
                  <td className="mono">{c.name}</td>
                  <td>
                    {c.required ? <span className="badge badge--brand">Required</span> : <span className="badge">Optional</span>}
                  </td>
                  <td className="subtle mono" style={{ fontSize: 13 }}>
                    {c.aliases}
                  </td>
                  <td className="mono" style={{ fontSize: 13 }}>
                    {c.example}
                  </td>
                  <td className="muted" style={{ fontSize: 13 }}>
                    {c.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
