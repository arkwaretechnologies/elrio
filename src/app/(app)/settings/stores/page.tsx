
import { StoreManagementClient } from "@/components/store-management-client";
import { getStores } from "@/services/store-service";

export default async function StoresPage() {
  const stores = await getStores();

  return (
    <div className="p-6">
      <StoreManagementClient initialStores={stores} />
    </div>
  );
}
