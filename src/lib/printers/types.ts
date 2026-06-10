import type { PrinterDeviceConfig, StorePrinterSettings } from "@/lib/types";

export type PrinterSlot = "cashier" | "kitchen";

export type PrintDocumentKind = "kitchen" | "receipt";

export type PrintJob = {
  html: string;
  title: string;
};

export function deviceForSlot(
  settings: StorePrinterSettings | undefined,
  slot: PrinterSlot,
): PrinterDeviceConfig | undefined {
  if (!settings) return undefined;
  return slot === "cashier" ? settings.cashier : settings.kitchen;
}
