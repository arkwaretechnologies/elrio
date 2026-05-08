
import ExpensesPage from "@/app/(app)/expenses/page";

export default function AdminExpensesPage({ selectedStoreId }: { selectedStoreId?: string }) {
    return <ExpensesPage selectedStoreId={selectedStoreId} />;
}
