import { getAuthContext, getSocialManagersData } from "@/lib/data";
import { Forbidden } from "@/components/forbidden";
import { SocialMediaClient } from "@/components/modules/social-media/social-media-client";

export default async function SocialMediaPage() {
  const owner = await getAuthContext();
  if (!owner?.gymId) {
    return <Forbidden message="Social media manager is owner-only." />;
  }
  const data = await getSocialManagersData();
  return <SocialMediaClient {...data} />;
}
