/**
 * Canonical public origin for links that leave the app (verification emails,
 * etc.). Prefers NEXT_PUBLIC_SITE_URL; on Vercel falls back to the production
 * deployment URL; else localhost in dev. Trailing slashes stripped.
 */
export function siteUrl(): string {
  const raw =
    (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return raw.replace(/\/+$/, "");
}
