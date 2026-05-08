"use client";

import { PosSessionProvider } from "@/context/pos-session-context";

export default function PosSectionLayout({ children }: { children: React.ReactNode }) {
  return <PosSessionProvider>{children}</PosSessionProvider>;
}
