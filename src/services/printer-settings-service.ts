"use client";

import type { StorePrinterSettings } from "@/lib/types";
import { DEFAULT_STORE_PRINTER_SETTINGS } from "@/lib/types";
import { getStore, updateStore } from "@/services/store-service";

export async function getStorePrinterSettings(
  storeId: string,
): Promise<StorePrinterSettings> {
  const store = await getStore(storeId);
  return store?.printerSettings ?? { ...DEFAULT_STORE_PRINTER_SETTINGS };
}

export async function saveStorePrinterSettings(
  storeId: string,
  settings: StorePrinterSettings,
): Promise<void> {
  await updateStore(storeId, { printerSettings: settings });
}
