import { redirect } from "next/navigation";
import { POS_FEATURE_TABLES } from "@/lib/pos-features";
import { TableManagementClient } from "@/components/table-management-client";

export default function SuperAdminTablesPage() {
  if (!POS_FEATURE_TABLES) {
    redirect("/super-admin");
  }

  return (
    <div className="p-6">
      <TableManagementClient />
    </div>
  );
}
