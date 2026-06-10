import type { PrinterDeviceConfig } from "@/lib/types";

export async function printIp(config: PrinterDeviceConfig, plainText: string): Promise<void> {
  const host = config.ipHost?.trim();
  const port = config.ipPort ?? 9100;
  if (!host) throw new Error("IP printer host is not configured.");

  const res = await fetch("/api/print", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host, port, text: plainText }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `IP print failed (${res.status}).`);
  }
}
