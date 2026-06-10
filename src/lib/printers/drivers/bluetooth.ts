import type { PrinterDeviceConfig } from "@/lib/types";

const SPP_SERVICE = "00001101-0000-1000-8000-00805f9b34fb";

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export async function pairBluetoothPrinter(): Promise<{
  deviceId: string;
  deviceName: string;
}> {
  if (!isWebBluetoothSupported()) {
    throw new Error("Web Bluetooth is not supported in this browser.");
  }
  const bt = navigator.bluetooth;
  if (!bt) throw new Error("Web Bluetooth is not supported in this browser.");
  const device = await bt.requestDevice({
    acceptAllDevices: true,
    optionalServices: [SPP_SERVICE],
  });
  const name = device.name ?? "Bluetooth printer";
  return { deviceId: device.id, deviceName: name };
}

export async function printBluetooth(
  config: PrinterDeviceConfig,
  plainText: string,
): Promise<void> {
  if (!isWebBluetoothSupported()) {
    throw new Error("Web Bluetooth is not supported in this browser.");
  }
  if (!config.bluetoothDeviceId) {
    throw new Error("Bluetooth printer not paired. Open Settings → Printers.");
  }
  const bt = navigator.bluetooth;
  if (!bt) throw new Error("Web Bluetooth is not supported in this browser.");
  const device = await bt.requestDevice({
    acceptAllDevices: true,
    optionalServices: [SPP_SERVICE],
  });
  const server = await device.gatt?.connect();
  if (!server) throw new Error("Could not connect to Bluetooth printer.");
  const service = await server.getPrimaryService(SPP_SERVICE);
  const characteristics = await service.getCharacteristics();
  const writable = characteristics.find((c) => c.properties.write || c.properties.writeWithoutResponse);
  if (!writable) throw new Error("No writable Bluetooth characteristic.");
  const payload = new TextEncoder().encode("\x1b\x40" + plainText + "\n\n");
  await writable.writeValue(payload);
  server.disconnect();
}
