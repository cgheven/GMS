import { getAuthContext, getInventoryData } from "@/lib/data";
import { Forbidden } from "@/components/forbidden";
import { InventoryClient } from "@/components/modules/inventory/inventory-client";

export default async function InventoryPage() {
  const owner = await getAuthContext();
  if (!owner?.gymId) {
    return <Forbidden message="Inventory is owner-only." />;
  }
  const data = await getInventoryData();
  return <InventoryClient {...data} />;
}
