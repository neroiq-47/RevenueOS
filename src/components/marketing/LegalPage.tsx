import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import styles from "./legal.module.css";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className={`bg-grid ${styles.page}`}>
      <Navbar />
      <main className="container">
        <article className={styles.doc}>
          <header className={styles.head}>
            <p className={styles.draft} role="note">
              Draft — review with counsel before public launch
            </p>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.updated}>Last updated {updated}</p>
          </header>
          <div className={styles.body}>{children}</div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
