import { redirect } from "next/navigation";
import { getSocialManagerPageData } from "@/lib/data";
import { SocialManagerClient } from "@/components/modules/social-manager/social-manager-client";

export default async function SocialManagerPage() {
  const data = await getSocialManagerPageData();
  if (!data) redirect("/login");
  return <SocialManagerClient {...data} />;
}
