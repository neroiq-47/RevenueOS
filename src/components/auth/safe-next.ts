/**
 * Returns `next` only when it is a same-origin relative path ("/foo"), never a
 * protocol-relative ("//evil.com") or backslash ("/\evil.com") URL. Otherwise `fallback`.
 */
export function safeNext(next: string | null | undefined, fallback = "/app"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
