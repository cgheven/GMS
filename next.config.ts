import type { NextConfig } from "next";

// Content-Security-Policy. script/style allow 'unsafe-inline'/'unsafe-eval'
// because Next.js App Router ships inline bootstrap scripts and Tailwind injects
// inline styles; there is no user-controlled HTML sink in the app (verified in
// the 2026-11-15 audit), so this is defense-in-depth. connect-src is locked to
// our own origin + Supabase (REST + realtime), frames/objects are blocked, and
// base-uri/form-action are pinned. Tighten script-src to per-request nonces later.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "X-Frame-Options",           value: "DENY" },
  { key: "X-XSS-Protection",          value: "0" }, // modern guidance: disable the legacy auditor (CSP is the control)
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",        value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy",   value: csp },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  compress: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    // Tree-shake icon and chart imports — ships only what's used
    optimizePackageImports: ["lucide-react", "recharts", "@radix-ui/react-dialog", "@radix-ui/react-select", "@radix-ui/react-label"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Proxy member photos through our own domain so the Supabase storage URL
  // (project ref) never appears in member-facing image links. Stored
  // photo_url values are relative (/media/member-photos/...) and Next.js
  // streams them from Supabase server-side.
  async rewrites() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return [];
    return [
      {
        source: "/media/member-photos/:path*",
        destination: `${supabaseUrl}/storage/v1/object/public/member-photos/:path*`,
      },
    ];
  },
};

export default nextConfig;
