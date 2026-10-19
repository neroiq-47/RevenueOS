import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "What data RevenueOS collects, who processes it, and how to export or delete it.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy notice" updated="October 2026">
      <p>
        This notice explains, in plain language, what RevenueOS (“we”) collects when you use the service, why, who
        helps us process it, and what you can do about it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong> — your email address, a hashed password (managed by our authentication
          provider), and the company name you enter at signup.
        </li>
        <li>
          <strong>Data you upload</strong> — the opportunities and contacts in the CSV files you import, such as deal
          names, contact names and email addresses, amounts, stages and activity dates.
        </li>
        <li>
          <strong>Generated drafts</strong> — the follow-up drafts you generate, any edits you save, and the
          outcomes you record on opportunities.
        </li>
        <li>
          <strong>Billing records</strong> — your subscription status and Stripe customer identifiers. Card details
          are entered on Stripe’s pages and never reach our servers.
        </li>
        <li>
          <strong>Technical data</strong> — session cookies needed to keep you signed in, and standard server logs
          kept by our hosting provider.
        </li>
      </ul>

      <h2>Why we use it</h2>
      <p>
        Only to run the service for you: signing you in, showing your pipeline and stale deals, generating drafts when
        you ask, billing your subscription, and keeping the service secure. We don’t sell your data and we don’t use it
        for advertising.
      </p>

      <h2>Who processes it</h2>
      <ul>
        <li>
          <strong>Supabase</strong> — authentication and database hosting. Your organisation’s data is separated from
          other tenants with row-level security.
        </li>
        <li>
          <strong>Stripe</strong> — subscription checkout, invoicing and the billing portal.
        </li>
        <li>
          <strong>OpenAI</strong> — draft generation. When you request a draft, only the details of that opportunity
          (for example deal name, contact name, amount, stage and days inactive) are sent. Your full CSV is not sent.
        </li>
        <li>
          <strong>Vercel</strong> — application hosting.
        </li>
      </ul>
      <p>RevenueOS never sends email to your contacts. You copy drafts and send them yourself.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account and uploaded data while your account exists. When you delete your organisation’s data
        from the Account page, it is removed from our application database. Billing records may be retained by Stripe
        and by us where required for tax and accounting purposes. Routine backups and logs held by our processors expire
        on their own schedules.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>
          <strong>Export</strong> — download your opportunities from the <Link href="/app/account">Account page</Link>.
        </li>
        <li>
          <strong>Delete</strong> — delete your organisation’s data from the same page.
        </li>
        <li>
          <strong>Ask us</strong> — for access, correction or any other request, email{" "}
          <a href="mailto:privacy@revenueos.example">privacy@revenueos.example</a>.
        </li>
      </ul>

      <h2>Your contacts’ data</h2>
      <p>
        You decide which contact information to upload. Please only upload data you’re allowed to use for following up
        on your own business opportunities.
      </p>

      <h2>Changes</h2>
      <p>If we change this notice in a meaningful way, we’ll update the date above and let account owners know.</p>
    </LegalPage>
  );
}
