import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Terms",
  description: "Pilot terms for using RevenueOS Lite.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Pilot terms" updated="October 2026">
      <p>
        These terms apply to your use of RevenueOS Lite (“the service”). By creating an account you agree to them on
        behalf of your organisation.
      </p>

      <h2>1. Pilot software</h2>
      <p>
        RevenueOS Lite is early-stage software offered as a pilot. Features may change, and the service may have bugs
        or downtime. It is provided “as is”, without any warranty of production readiness, availability, or fitness
        for a particular purpose.
      </p>

      <h2>2. Your account</h2>
      <p>
        Each organisation has one owner account. You’re responsible for keeping your login secure and for activity
        under your account.
      </p>

      <h2>3. Subscription and billing</h2>
      <p>
        The service costs $499 per organisation per month, billed in advance through Stripe. You can cancel anytime
        from the billing portal; cancellation stops future renewals. Fees already paid are not refunded unless
        required by law.
      </p>

      <h2>4. AI-generated drafts</h2>
      <p>
        Drafts are suggestions produced by an AI model and may be inaccurate or inappropriate. RevenueOS never sends
        messages on your behalf. <strong>You are responsible for reviewing every draft and for any message you
        send</strong>, including complying with applicable marketing, privacy and anti-spam laws.
      </p>

      <h2>5. Your data</h2>
      <p>
        You keep ownership of the data you upload. You confirm you have the right to upload it and use it to follow up
        on your own business opportunities. We handle it as described in our{" "}
        <Link href="/privacy">privacy notice</Link>. You can export or delete it from the Account page.
      </p>

      <h2>6. Acceptable use</h2>
      <p>
        Don’t use the service to send unsolicited bulk messages, to break the law, or to try to access other
        organisations’ data or disrupt the service.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        To the extent permitted by law, our total liability for any claim relating to the service is limited to the
        fees you paid in the three months before the claim. We aren’t liable for lost deals, lost profits, or indirect
        damages.
      </p>

      <h2>8. Changes and termination</h2>
      <p>
        We may update these terms as the pilot evolves and will notify account owners of material changes. We may
        suspend accounts that breach these terms. You can stop using the service at any time.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Email <a href="mailto:privacy@revenueos.example">privacy@revenueos.example</a>.
      </p>
    </LegalPage>
  );
}
