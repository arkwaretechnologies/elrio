
"use client";

import React from 'react';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { PosLayout } from '@/components/pos-layout';
import { SuperAdminLayout } from '@/components/super-admin-layout';
import { usePathname } from 'next/navigation';
import { CartProvider } from '@/context/cart-context';

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  
  const isAdminOrOwner = user?.role === 'Admin' || user?.role === 'Owner';
  const isAdminView = isAdminOrOwner && pathname.startsWith('/super-admin');

  if (isAdminView) {
    return (
      <SuperAdminLayout>
        {children}
      </SuperAdminLayout>
    );
  }

  // All other users, or Admin viewing non-admin pages (like POS)
  return (
    <CartProvider>
      <PosLayout>
        <div className="relative h-full">
          {children}
        </div>
      </PosLayout>
    </CartProvider>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AppLayoutContent>
        {children}
      </AppLayoutContent>
    </AuthProvider>
  );
}
