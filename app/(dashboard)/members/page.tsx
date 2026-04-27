import { getMembers } from "@/lib/data";
import { MembersClient } from "@/components/modules/members/members-client";

export default async function MembersPage() {
  const data = await getMembers();
  return <MembersClient {...data} />;
}
