import { redirect } from "next/navigation";
import { getSocialManagerContext } from "@/lib/data";
import { SocialShell } from "@/components/layout/social-shell";

export default async function SocialLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSocialManagerContext();
  if (!ctx) redirect("/login");
  return <SocialShell manager={ctx.manager}>{children}</SocialShell>;
}
