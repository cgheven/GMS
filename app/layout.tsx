import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
});

// Canonical public origin, so Next resolves the og:image / twitter:image
// (app/opengraph-image.jpg) to an absolute URL a WhatsApp/social crawler can
// fetch. Set NEXT_PUBLIC_SITE_URL to the production domain; on Vercel it falls
// back to the deployment's production URL automatically, else localhost in dev.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const title = "Pulse — Gym Management System";
const description =
  "Pulse of your gym — manage members, payments, staff, leads and more in one place.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "Pulse",
  // app/icon.jpg + app/apple-icon.jpg are picked up automatically by Next's
  // file conventions; app/opengraph-image.jpg supplies og:image + twitter:image.
  openGraph: {
    type: "website",
    siteName: "Pulse",
    title,
    description,
    url: siteUrl,
    locale: "en_PK",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans" suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
