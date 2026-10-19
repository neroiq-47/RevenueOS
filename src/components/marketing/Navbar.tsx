import Link from "next/link";
import { Logo } from "@/components/Logo";
import styles from "./marketing.module.css";

const anchors = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function Navbar() {
  return (
    <header className={styles.nav}>
      <div className={`container ${styles.navInner}`}>
        <Logo size={26} />
        <nav aria-label="Main">
          <ul className={styles.navLinks}>
            {anchors.map((a) => (
              <li key={a.href}>
                <a className={styles.navLink} href={a.href}>
                  {a.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.navActions}>
          <Link href="/login" className="btn btn--sm btn--ghost">
            Log in
          </Link>
          <Link href="/signup" className="btn btn--sm btn--primary">
            <span className={styles.ctaLong}>Start recovering</span>
            <span className={styles.ctaShort}>Start</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
