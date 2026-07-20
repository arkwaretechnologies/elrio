"use client";

import { useAuth } from "@/context/auth-context";
import { MenuGrid } from "@/components/menu-grid";
import { CartDisplay } from "@/components/cart-display";
import { CakeLoader } from "@/components/cake-loader";

export default function PosPage() {
  const { loading, currentStore } = useAuth();
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
    <div className="grid min-h-0 grid-cols-1 bg-background md:flex-1 md:grid-cols-4 md:overflow-hidden">
      <div className="min-h-0 p-4 sm:p-6 md:col-span-3 md:overflow-y-auto md:border-r md:border-border/80">
        <MenuGrid />
      </div>
      <aside className="flex min-h-[min(42dvh,24rem)] flex-col border-t border-border/80 bg-gradient-to-b from-card to-secondary/40 shadow-[0_0_40px_-12px_hsl(199_89%_48%_/_0.18)] md:col-span-1 md:min-h-0 md:overflow-hidden md:border-l md:border-t-0">
        <CartDisplay />
      </aside>
    </div>
  );
}
