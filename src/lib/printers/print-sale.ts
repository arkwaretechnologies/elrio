import type { Sale, StorePrinterSettings } from "@/lib/types";
import { buildCashierReceiptHtml, buildKitchenTicketHtml } from "./templates";
import { deviceForSlot, type PrinterSlot } from "./types";
import { printHtmlKiosk } from "./drivers/kiosk";
import { printUsb } from "./drivers/usb";
import { printBluetooth } from "./drivers/bluetooth";
import { printIp } from "./drivers/ip";
import { formatPickupNumber } from "@/lib/pickup-number";
import { saleServiceLabel } from "@/lib/order-service-label";

function saleToPlainText(sale: Sale, kind: "kitchen" | "receipt"): string {
  const pickup = formatPickupNumber(sale.pickupNumber);
  const service = saleServiceLabel(sale) === "dine-in" ? "DINE IN" : "TAKEOUT";
  const header = kind === "kitchen" ? "KITCHEN" : "RECEIPT";
  const lines = sale.items.map(
    (i) => `${i.quantity}x ${i.name}  ${(i.price * i.quantity).toFixed(2)}`,
  );
  const total = `TOTAL: ${sale.total.toFixed(2)}`;
  return [header, `#${pickup}`, service, ...lines, total].join("\n");
}

async function printToSlot(
  settings: StorePrinterSettings | undefined,
  slot: PrinterSlot,
  sale: Sale,
  kind: "kitchen" | "receipt",
): Promise<void> {
  const device = deviceForSlot(settings, slot);
  const html = kind === "kitchen" ? buildKitchenTicketHtml(sale) : buildCashierReceiptHtml(sale);
  const plain = saleToPlainText(sale, kind);
  const title = kind === "kitchen" ? "Kitchen" : "Receipt";

  if (!device?.enabled) {
    await printHtmlKiosk(html, title);
    return;
  }

  try {
    switch (device.connection) {
      case "usb":
        await printUsb(device, plain);
        break;
      case "bluetooth":
        await printBluetooth(device, plain);
        break;
      case "ip":
        await printIp(device, plain);
        break;
      default:
        await printHtmlKiosk(html, title);
    }
  } catch {
    await printHtmlKiosk(html, title);
  }
}

export async function printKitchenCopy(
  sale: Sale,
  settings?: StorePrinterSettings,
): Promise<void> {
  await printToSlot(settings, "kitchen", sale, "kitchen");
}

export async function printCashierReceipt(
  sale: Sale,
  settings?: StorePrinterSettings,
): Promise<void> {
  await printToSlot(settings, "cashier", sale, "receipt");
}

export async function printTestPage(
  slot: PrinterSlot,
  settings: StorePrinterSettings,
): Promise<void> {
  const device = deviceForSlot(settings, slot);
  const label = slot === "cashier" ? "Cashier" : "Kitchen";
  const html = `<!DOCTYPE html><html><body style="font-family:monospace;padding:12px"><h2>${label} test</h2><p>Printer OK</p></body></html>`;
  const plain = `${label.toUpperCase()} TEST\nPrinter OK`;

  if (!device?.enabled) {
    await printHtmlKiosk(html, `${label} test`);
    return;
  }

  switch (device.connection) {
    case "usb":
      await printUsb(device, plain);
      break;
    case "bluetooth":
      await printBluetooth(device, plain);
      break;
    case "ip":
      await printIp(device, plain);
      break;
    default:
      await printHtmlKiosk(html, `${label} test`);
  }
}
