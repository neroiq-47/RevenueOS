import { requireOrg } from "@/lib/org";
import { AppNav } from "./AppNav";
import styles from "./app-shell.module.css";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrg();
  return (
    <div className={`${styles.shell} bg-grid`}>
      <div className="glow glow--blue" style={{ width: 420, height: 420, top: -200, left: -120 }} />
      <div className="glow glow--violet" style={{ width: 360, height: 360, top: -180, right: -140, opacity: 0.3 }} />
      <AppNav orgName={ctx.org.name} email={ctx.email} entitled={ctx.entitled} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
