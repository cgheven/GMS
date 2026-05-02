import { redirect } from "next/navigation";
import { getReferrerPageData } from "@/lib/data";
import { ReferrerClient } from "@/components/modules/referrer/referrer-client";

export default async function ReferrerPage() {
  const data = await getReferrerPageData();
  if (!data) redirect("/login");
  return <ReferrerClient {...data} />;
}
