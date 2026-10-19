import Link from "next/link";
import { Logo } from "@/components/Logo";
import styles from "./marketing.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <Logo size={24} />
        <nav aria-label="Footer">
          <ul className={styles.footerLinks}>
            <li>
              <Link href="/#pricing">Pricing</Link>
            </li>
            <li>
              <Link href="/login">Log in</Link>
            </li>
            <li>
              <Link href="/signup">Sign up</Link>
            </li>
            <li>
              <Link href="/privacy">Privacy</Link>
            </li>
            <li>
              <Link href="/terms">Terms</Link>
            </li>
          </ul>
        </nav>
        <p className={styles.copy}>© {new Date().getFullYear()} RevenueOS · AI drafts are suggestions — you send every message yourself.</p>
      </div>
    </footer>
  );
}
