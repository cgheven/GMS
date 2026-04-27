import { getIssues } from "@/lib/data";
import { IssuesClient } from "@/components/modules/issues/issues-client";

export default async function IssuesPage() {
  const data = await getIssues();
  return <IssuesClient {...data} />;
}
