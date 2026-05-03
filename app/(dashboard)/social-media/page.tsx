import { getSocialManagersData } from "@/lib/data";
import { SocialMediaClient } from "@/components/modules/social-media/social-media-client";

export default async function SocialMediaPage() {
  const data = await getSocialManagersData();
  return <SocialMediaClient {...data} />;
}
