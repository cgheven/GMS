import { getAuthContext, getClasses } from "@/lib/data";
import { Forbidden } from "@/components/forbidden";
import { ClassesClient } from "@/components/modules/classes/classes-client";

export default async function ClassesPage() {
  const owner = await getAuthContext();
  if (!owner?.gymId) {
    return <Forbidden message="Class scheduling is owner-only." />;
  }
  const data = await getClasses();
  return <ClassesClient {...data} />;
}
