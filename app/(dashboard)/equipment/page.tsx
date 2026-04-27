import { getEquipment } from "@/lib/data";
import { EquipmentClient } from "@/components/modules/equipment/equipment-client";

export default async function EquipmentPage() {
  const data = await getEquipment();
  return <EquipmentClient {...data} />;
}
