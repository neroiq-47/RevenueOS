"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import styles from "./app-shell.module.css";

const links = [
  { href: "/app", label: "Opportunities" },
  { href: "/app/import", label: "Import CSV" },
  { href: "/app/billing", label: "Billing" },
  { href: "/app/account", label: "Account" },
];

export function AppNav({ orgName, email, entitled }: { orgName: string; email: string; entitled: boolean }) {
  const pathname = usePathname();
  return (
    <header className={styles.nav}>
      <div className={styles.navInner}>
        <Logo size={26} href="/app" />
        <nav className={styles.links} aria-label="App">
          {links.map((l) => {
            const active = l.href === "/app" ? pathname === "/app" : pathname.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={`${styles.link} ${active ? styles.active : ""}`}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className={styles.meta}>
          <span className={`badge ${entitled ? "badge--success" : "badge--warning"}`}>
            {entitled ? "Active" : "No subscription"}
          </span>
          <span className={styles.org} title={email}>
            {orgName}
          </span>
          <form action="/auth/signout" method="post">
            <button className="btn btn--sm btn--ghost" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
