"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { CartItem, OpenOrder, SeniorDiscountDetails } from "@/lib/types";
import { generateOrderNumber } from "@/lib/order-number";

const COLLECTION = "openOrders";

function toDateSafe(v: unknown): Date {
  if (v != null && typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  if (v instanceof Date) return v;
  return new Date();
}

export type CreateOpenOrderInput = {
  storeId: string;
  items: CartItem[];
  manualDiscount: number;
  seniorDiscountDetails: SeniorDiscountDetails | null;
  subtotal: number;
  discount: number;
  total: number;
  tableId?: string | null;
  tableLabel?: string | null;
  serviceType?: "dine-in" | "takeout" | null;
  note?: string | null;
  createdByUserId?: string | null;
  createdByName?: string | null;
};

/** Strip undefined for Firestore. */
function serializeItems(items: CartItem[]): CartItem[] {
  return JSON.parse(JSON.stringify(items)) as CartItem[];
}

export async function createOpenOrder(data: CreateOpenOrderInput): Promise<string> {
  const orderNumber = generateOrderNumber();
  const ref = await addDoc(collection(db, COLLECTION), {
    storeId: data.storeId,
    orderNumber,
    items: serializeItems(data.items),
    manualDiscount: data.manualDiscount,
    seniorDiscountDetails: data.seniorDiscountDetails,
    subtotal: data.subtotal,
    discount: data.discount,
    total: data.total,
    tableId: data.tableId ?? null,
    tableLabel: data.tableLabel ?? null,
    serviceType: data.serviceType ?? null,
    note: data.note?.trim() || null,
    createdByUserId: data.createdByUserId ?? null,
    createdByName: data.createdByName ?? null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteOpenOrder(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function updateOpenOrderAssignment(
  id: string,
  patch: {
    tableId: string | null;
    tableLabel: string | null;
    serviceType: "dine-in" | "takeout";
  },
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    tableId: patch.tableId,
    tableLabel: patch.tableLabel,
    serviceType: patch.serviceType,
  });
}

export function subscribeOpenOrders(storeId: string, onUpdate: (orders: OpenOrder[]) => void): () => void {
  const q = query(collection(db, COLLECTION), where("storeId", "==", storeId));
  return onSnapshot(q, (snap) => {
    const list: OpenOrder[] = snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        storeId: x.storeId as string,
        items: (x.items as CartItem[]) ?? [],
        manualDiscount: typeof x.manualDiscount === "number" ? x.manualDiscount : 0,
        seniorDiscountDetails: (x.seniorDiscountDetails as SeniorDiscountDetails | null) ?? null,
        subtotal: typeof x.subtotal === "number" ? x.subtotal : 0,
        discount: typeof x.discount === "number" ? x.discount : 0,
        total: typeof x.total === "number" ? x.total : 0,
        tableId: x.tableId ?? null,
        tableLabel: x.tableLabel ?? null,
        serviceType: x.serviceType === "dine-in" || x.serviceType === "takeout" ? x.serviceType : null,
        note: x.note ?? null,
        createdAt: toDateSafe(x.createdAt),
        createdByUserId: x.createdByUserId ?? null,
        createdByName: x.createdByName ?? null,
        orderNumber: typeof x.orderNumber === "number" ? x.orderNumber : undefined,
      };
    });
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    onUpdate(list);
  });
}
