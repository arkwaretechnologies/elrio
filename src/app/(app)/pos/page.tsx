"use client";

import { useAuth } from "@/context/auth-context";
import { usePosSession } from "@/context/pos-session-context";
import { MenuGrid } from "@/components/menu-grid";
import { CartDisplay } from "@/components/cart-display";
import { CakeLoader } from "@/components/cake-loader";

export default function PosPage() {
  const { loading, currentStore } = useAuth();
  const { selectedTable, setSelectedTable } = usePosSession();

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <CakeLoader />
        <p className="mt-4 text-muted-foreground">Loading your Point of Sale…</p>
      </div>
    );
  }

  if (!currentStore) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-muted-foreground">Please select a store to begin.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 bg-background lg:grid-cols-4 lg:h-full">
      <div className="lg:col-span-3 lg:h-full lg:overflow-y-auto p-4 sm:p-6 lg:border-r lg:border-border/80">
        <MenuGrid />
      </div>
      <aside className="flex flex-col border-t border-border/80 bg-gradient-to-b from-card to-secondary/40 shadow-[0_0_40px_-12px_hsl(199_89%_48%_/_0.18)] lg:col-span-1 lg:h-full lg:border-l lg:border-t-0">
        <CartDisplay selectedTable={selectedTable} onSelectedTableChange={setSelectedTable} />
      </aside>
    </div>
  );
}
