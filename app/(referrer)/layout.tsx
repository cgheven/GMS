import { redirect } from "next/navigation";
import { getReferrerContext } from "@/lib/data";
import { ReferrerShell } from "@/components/layout/referrer-shell";

export default async function ReferrerLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getReferrerContext();
  if (!ctx) redirect("/login");
  return <ReferrerShell referrer={ctx.referrer}>{children}</ReferrerShell>;
}
