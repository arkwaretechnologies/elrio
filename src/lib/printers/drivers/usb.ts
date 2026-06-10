import type { PrinterDeviceConfig } from "@/lib/types";

const ESC = {
  INIT: "\x1b\x40",
  CUT: "\x1d\x56\x00",
};

/** USB device class 7 = printer. Plus common ESC/POS vendor IDs. */
const USB_PRINTER_FILTERS: USBDeviceFilter[] = [
  { classCode: 7 },
  { vendorId: 0x04b8 }, // Epson
  { vendorId: 0x0519 }, // Star Micronics
  { vendorId: 0x1504 }, // Bixolon
  { vendorId: 0x2730 }, // Citizen
  { vendorId: 0x0dd4 }, // Custom / Posiflex
  { vendorId: 0x154f }, // SNBC
  { vendorId: 0x0483 }, // STM / some generics
];

export type UsbPrinterInfo = {
  id: string;
  vendorId: number;
  productId: number;
  serialNumber?: string;
  deviceName: string;
};

function textToEscPos(text: string): Uint8Array {
  const body = ESC.INIT + text + "\n\n" + ESC.CUT;
  return new TextEncoder().encode(body);
}

export function usbPrinterKey(
  vendorId: number,
  productId: number,
  serialNumber?: string | null,
): string {
  const serial = serialNumber?.trim();
  return serial ? `${vendorId}:${productId}:${serial}` : `${vendorId}:${productId}`;
}

function deviceLabel(device: USBDevice): string {
  const name = device.productName?.trim();
  const mfg = device.manufacturerName?.trim();
  const base = name || mfg || "USB printer";
  const serial = device.serialNumber?.trim();
  const ids = `VID ${device.vendorId.toString(16).padStart(4, "0")} · PID ${device.productId.toString(16).padStart(4, "0")}`;
  return serial ? `${base} (${serial})` : `${base} — ${ids}`;
}

export function usbInfoFromDevice(device: USBDevice): UsbPrinterInfo {
  return {
    id: usbPrinterKey(device.vendorId, device.productId, device.serialNumber),
    vendorId: device.vendorId,
    productId: device.productId,
    serialNumber: device.serialNumber,
    deviceName: deviceLabel(device),
  };
}

export function configMatchesUsbDevice(
  config: PrinterDeviceConfig,
  device: USBDevice,
): boolean {
  if (config.usbVendorId == null || config.usbProductId == null) return false;
  if (
    device.vendorId !== config.usbVendorId ||
    device.productId !== config.usbProductId
  ) {
    return false;
  }
  const savedSerial = config.usbSerialNumber?.trim();
  if (savedSerial) {
    return device.serialNumber?.trim() === savedSerial;
  }
  return true;
}

export function isWebUsbSupported(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator;
}

/** USB printers this browser has already been allowed to access. */
export async function listAuthorizedUsbPrinters(): Promise<UsbPrinterInfo[]> {
  if (!isWebUsbSupported()) return [];
  const devices = await navigator.usb!.getDevices();
  const seen = new Set<string>();
  const list: UsbPrinterInfo[] = [];
  for (const device of devices) {
    const info = usbInfoFromDevice(device);
    if (seen.has(info.id)) continue;
    seen.add(info.id);
    list.push(info);
  }
  list.sort((a, b) => a.deviceName.localeCompare(b.deviceName));
  return list;
}

/**
 * Opens the browser USB picker (printer-focused filters) so the user can
 * allow another printer. Returns the full list of authorized printers after.
 */
export async function detectUsbPrinters(): Promise<UsbPrinterInfo[]> {
  if (!isWebUsbSupported()) {
    throw new Error("WebUSB is not supported in this browser. Use Chrome or Edge.");
  }
  const usb = navigator.usb;
  if (!usb) throw new Error("WebUSB is not available.");

  try {
    const picked = await usb.requestDevice({ filters: USB_PRINTER_FILTERS });
    await picked.open();
    await picked.close();
  } catch (e) {
    if (e instanceof DOMException && e.name === "NotFoundError") {
      return listAuthorizedUsbPrinters();
    }
    throw e;
  }

  return listAuthorizedUsbPrinters();
}

export async function printUsb(
  config: PrinterDeviceConfig,
  plainText: string,
): Promise<void> {
  if (!isWebUsbSupported()) {
    throw new Error("WebUSB is not supported in this browser.");
  }
  if (config.usbVendorId == null || config.usbProductId == null) {
    throw new Error("No USB printer selected. Open Settings → Printers.");
  }
  const devices = await navigator.usb!.getDevices();
  const device = devices.find((d) => configMatchesUsbDevice(config, d));
  if (!device) {
    throw new Error("USB printer not connected. Detect printers and select it again.");
  }
  await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);
  const iface = device.configuration!.interfaces[0];
  await device.claimInterface(iface.interfaceNumber);
  const outEndpoint = iface.alternate.endpoints.find((e) => e.direction === "out");
  if (!outEndpoint) throw new Error("No USB OUT endpoint on this printer.");
  const data = textToEscPos(plainText);
  await device.transferOut(outEndpoint.endpointNumber, data);
  await device.close();
}
