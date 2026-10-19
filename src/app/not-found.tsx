import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { Navbar } from "@/components/marketing/Navbar";
import styles from "@/components/marketing/notfound.module.css";

export default function NotFound() {
  return (
    <div className={`bg-grid ${styles.page}`}>
      <Navbar />
      <main className={`container ${styles.main}`}>
        <div className="glow glow--blue" style={{ width: 420, height: 420, top: "10%", left: "50%", marginLeft: -210, opacity: 0.35 }} aria-hidden="true" />
        <div className={styles.mark} aria-hidden="true">
          <LogoMark size={96} />
        </div>
        <p className={styles.code}>
          <span className="sr-only">Error </span>404 · route_not_found
        </p>
        <h1 className={styles.title}>
          This page has gone <span className="gradient-text">stale.</span>
        </h1>
        <p className={styles.lead}>
          The link may be broken or the page may have moved. Unlike your quotes, this one isn’t worth chasing.
        </p>
        <div className="row row--wrap" style={{ justifyContent: "center" }}>
          <Link href="/" className="btn btn--primary btn--lg">
            Back to home
          </Link>
          <Link href="/app" className="btn btn--lg">
            Go to dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
