import { getAuthContext, getIssues } from "@/lib/data";
import { Forbidden } from "@/components/forbidden";
import { IssuesClient } from "@/components/modules/issues/issues-client";

export default async function IssuesPage() {
  const owner = await getAuthContext();
  if (!owner?.gymId) {
    return <Forbidden message="Issues are owner-only." />;
  }
  const data = await getIssues();
  return <IssuesClient {...data} />;
}
