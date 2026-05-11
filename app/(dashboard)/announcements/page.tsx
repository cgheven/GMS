import { getAuthContext, getAnnouncements } from "@/lib/data";
import { Forbidden } from "@/components/forbidden";
import { AnnouncementsClient } from "@/components/modules/announcements/announcements-client";

export default async function AnnouncementsPage() {
  const owner = await getAuthContext();
  if (!owner?.gymId) {
    return <Forbidden message="Announcements are owner-only." />;
  }
  const data = await getAnnouncements();
  return <AnnouncementsClient {...data} />;
}
