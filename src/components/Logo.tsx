import Link from "next/link";

/** RevenueOS asterisk mark, optionally with the wordmark. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.svg" width={size} height={size} alt="" aria-hidden="true" className={className} />;
}

export function Logo({ size = 28, href = "/" }: { size?: number; href?: string }) {
  return (
    <Link href={href} className="row" style={{ gap: 10 }} aria-label="RevenueOS home">
      <LogoMark size={size} />
      <span style={{ fontWeight: 700, fontSize: size * 0.68, letterSpacing: "-0.02em" }}>
        Revenue<span className="gradient-text">OS</span>
      </span>
    </Link>
  );
}
