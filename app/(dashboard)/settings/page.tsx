import { getAuthContext } from "@/lib/data";
import { Forbidden } from "@/components/forbidden";
import { SettingsClient } from "@/components/modules/settings/settings-client";

export const metadata = { title: "Settings | Pulse" };

export default async function SettingsPage() {
  const owner = await getAuthContext();
  if (!owner?.gymId) {
    return <Forbidden message="Settings are owner-only." />;
  }
  return <SettingsClient />;
}
