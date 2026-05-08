"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { FloorPlanTable } from "@/lib/types";

export function useStoreFloorTables(storeId: string | undefined) {
  const [tables, setTables] = useState<FloorPlanTable[]>([]);

  useEffect(() => {
    if (!storeId) {
      setTables([]);
      return;
    }
    const ref = doc(db, "stores", storeId);
    const unsub = onSnapshot(ref, (snap) => {
      const raw = snap.data()?.floorPlanTables;
      setTables(Array.isArray(raw) ? (raw as FloorPlanTable[]) : []);
    });
    return () => unsub();
  }, [storeId]);

  return tables;
}
