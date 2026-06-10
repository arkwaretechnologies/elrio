"use client";

import React, { createContext, useContext, useState } from "react";
import type { FloorPlanTable } from "@/lib/types";

export type PosServiceMode = 'dine-in' | 'takeout' | null;

type PosSessionContextType = {
  selectedTable: FloorPlanTable | null;
  setSelectedTable: (t: FloorPlanTable | null) => void;
  /** Neither selected until the cashier picks one; required before Pay / Pay later. */
  serviceMode: PosServiceMode;
  setServiceMode: (m: PosServiceMode) => void;
};

const PosSessionContext = createContext<PosSessionContextType | null>(null);

export function PosSessionProvider({ children }: { children: React.ReactNode }) {
  const [selectedTable, setSelectedTable] = useState<FloorPlanTable | null>(null);
  const [serviceMode, setServiceMode] = useState<PosServiceMode>(null);
  return (
    <PosSessionContext.Provider value={{ selectedTable, setSelectedTable, serviceMode, setServiceMode }}>
      {children}
    </PosSessionContext.Provider>
  );
}

export function usePosSession() {
  const ctx = useContext(PosSessionContext);
  if (!ctx) {
    throw new Error("usePosSession must be used within PosSessionProvider");
  }
  return ctx;
}
