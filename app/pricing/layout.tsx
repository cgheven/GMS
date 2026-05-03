import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Pulse",
  description: "PULSE OF YOUR GYM",
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
