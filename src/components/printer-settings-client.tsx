"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import {
  DEFAULT_STORE_PRINTER_SETTINGS,
  type PrinterConnectionType,
  type PrinterDeviceConfig,
  type StorePrinterSettings,
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  getStorePrinterSettings,
  saveStorePrinterSettings,
} from "@/services/printer-settings-service";
import { printTestPage } from "@/lib/printers/print-sale";
import { pairBluetoothPrinter } from "@/lib/printers/drivers/bluetooth";
import { CakeLoader } from "@/components/cake-loader";
import { UsbPrinterSelect } from "@/components/usb-printer-select";

function PrinterSlotForm({
  title,
  config,
  onChange,
  onTest,
  onPairBluetooth,
}: {
  title: string;
  config: PrinterDeviceConfig;
  onChange: (next: PrinterDeviceConfig) => void;
  onTest: () => void;
  onPairBluetooth: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor={`${title}-enabled`}>Enabled</Label>
          <Switch
            id={`${title}-enabled`}
            checked={config.enabled}
            onCheckedChange={(enabled) => onChange({ ...config, enabled })}
          />
        </div>
        <div className="space-y-2">
          <Label>Connection</Label>
          <Select
            value={config.connection}
            onValueChange={(v) =>
              onChange({ ...config, connection: v as PrinterConnectionType })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usb">USB</SelectItem>
              <SelectItem value="bluetooth">Bluetooth</SelectItem>
              <SelectItem value="ip">IP (network)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {config.connection === "usb" ? (
          <UsbPrinterSelect config={config} onChange={onChange} />
        ) : null}

        {config.connection === "bluetooth" ? (
          <div className="space-y-2 rounded-md border p-3 text-sm">
            <p className="text-muted-foreground">
              {config.bluetoothDeviceName
                ? `Paired: ${config.bluetoothDeviceName}`
                : "No Bluetooth printer paired."}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={onPairBluetooth}>
              Pair Bluetooth printer
            </Button>
          </div>
        ) : null}

        {config.connection === "ip" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Host</Label>
              <Input
                placeholder="192.168.1.50"
                value={config.ipHost ?? ""}
                onChange={(e) => onChange({ ...config, ipHost: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input
                type="number"
                placeholder="9100"
                value={config.ipPort ?? 9100}
                onChange={(e) =>
                  onChange({ ...config, ipPort: parseInt(e.target.value, 10) || 9100 })
                }
              />
            </div>
          </div>
        ) : null}

        <Button type="button" variant="secondary" size="sm" onClick={onTest}>
          Test print
        </Button>
      </CardContent>
    </Card>
  );
}

export function PrinterSettingsClient() {
  const { currentStore } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<StorePrinterSettings>({
    ...DEFAULT_STORE_PRINTER_SETTINGS,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentStore?.id) return;
    setLoading(true);
    void getStorePrinterSettings(currentStore.id)
      .then(setSettings)
      .finally(() => setLoading(false));
  }, [currentStore?.id]);

  const save = async () => {
    if (!currentStore) return;
    setSaving(true);
    try {
      await saveStorePrinterSettings(currentStore.id, settings);
      toast({ title: "Printer settings saved" });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not save",
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!currentStore) {
    return <p className="text-muted-foreground">Select a store first.</p>;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <CakeLoader />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Printers</h1>
        <p className="text-sm text-muted-foreground">
          Configure cashier and kitchen printers. When disabled, checkout falls back to browser
          print. For silent kiosk printing, enable Kiosk mode and launch Chrome with{" "}
          <code className="text-xs">--kiosk-printing</code>.
        </p>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between gap-4 pt-6">
          <div>
            <p className="font-medium">Kiosk printing</p>
            <p className="text-xs text-muted-foreground">
              Use silent print when the browser supports it.
            </p>
          </div>
          <Switch
            checked={!!settings.kioskPrinting}
            onCheckedChange={(kioskPrinting) => setSettings((s) => ({ ...s, kioskPrinting }))}
          />
        </CardContent>
      </Card>

      <PrinterSlotForm
        title="Cashier printer"
        config={settings.cashier}
        onChange={(cashier) => setSettings((s) => ({ ...s, cashier }))}
        onTest={() => void printTestPage("cashier", settings).catch((e) =>
          toast({ variant: "destructive", title: "Test failed", description: e.message }),
        )}
        onPairBluetooth={() =>
          void pairBluetoothPrinter()
            .then((p) =>
              setSettings((s) => ({
                ...s,
                cashier: {
                  ...s.cashier,
                  connection: "bluetooth",
                  bluetoothDeviceId: p.deviceId,
                  bluetoothDeviceName: p.deviceName,
                },
              })),
            )
            .catch((e) =>
              toast({
                variant: "destructive",
                title: "Bluetooth pair failed",
                description: e.message,
              }),
            )
        }
      />

      <PrinterSlotForm
        title="Kitchen printer"
        config={settings.kitchen}
        onChange={(kitchen) => setSettings((s) => ({ ...s, kitchen }))}
        onTest={() => void printTestPage("kitchen", settings).catch((e) =>
          toast({ variant: "destructive", title: "Test failed", description: e.message }),
        )}
        onPairBluetooth={() =>
          void pairBluetoothPrinter()
            .then((p) =>
              setSettings((s) => ({
                ...s,
                kitchen: {
                  ...s.kitchen,
                  connection: "bluetooth",
                  bluetoothDeviceId: p.deviceId,
                  bluetoothDeviceName: p.deviceName,
                },
              })),
            )
            .catch((e) =>
              toast({
                variant: "destructive",
                title: "Bluetooth pair failed",
                description: e.message,
              }),
            )
        }
      />

      <Button type="button" onClick={() => void save()} disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}
