import { getClasses } from "@/lib/data";
import { ClassesClient } from "@/components/modules/classes/classes-client";

export default async function ClassesPage() {
  const data = await getClasses();
  return <ClassesClient {...data} />;
}
