"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PrinterDeviceConfig } from "@/lib/types";
import {
  detectUsbPrinters,
  isWebUsbSupported,
  listAuthorizedUsbPrinters,
  usbPrinterKey,
  type UsbPrinterInfo,
} from "@/lib/printers/drivers/usb";
import { Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const NONE = "__none__";

export function UsbPrinterSelect({
  config,
  onChange,
}: {
  config: PrinterDeviceConfig;
  onChange: (next: PrinterDeviceConfig) => void;
}) {
  const { toast } = useToast();
  const [printers, setPrinters] = useState<UsbPrinterInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const refresh = useCallback(async () => {
    if (!isWebUsbSupported()) {
      setPrinters([]);
      return;
    }
    setLoading(true);
    try {
      setPrinters(await listAuthorizedUsbPrinters());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedId =
    config.usbVendorId != null && config.usbProductId != null
      ? usbPrinterKey(config.usbVendorId, config.usbProductId, config.usbSerialNumber)
      : NONE;

  const handleSelect = (value: string) => {
    if (value === NONE) {
      onChange({
        ...config,
        usbVendorId: undefined,
        usbProductId: undefined,
        usbSerialNumber: undefined,
        usbDeviceName: undefined,
      });
      return;
    }
    const picked = printers.find((p) => p.id === value);
    if (!picked) return;
    onChange({
      ...config,
      connection: "usb",
      usbVendorId: picked.vendorId,
      usbProductId: picked.productId,
      usbSerialNumber: picked.serialNumber,
      usbDeviceName: picked.deviceName,
    });
  };

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const list = await detectUsbPrinters();
      setPrinters(list);
      if (list.length === 0) {
        toast({
          title: "No USB printers",
          description: "Choose your receipt printer in the browser dialog, or use IP / browser print.",
        });
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not detect printers",
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      setDetecting(false);
    }
  };

  if (!isWebUsbSupported()) {
    return (
      <p className="text-sm text-muted-foreground">
        USB printer selection requires Chrome or Edge. Use IP or browser print instead.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-3 text-sm">
      <div className="space-y-2">
        <Label>Printer</Label>
        <Select value={selectedId} onValueChange={handleSelect} disabled={loading}>
          <SelectTrigger>
            <SelectValue placeholder="Select a USB printer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— None —</SelectItem>
            {printers.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.deviceName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {printers.length === 0 && !loading ? (
        <p className="text-muted-foreground">
          No USB printers detected yet. Plug in your printer, then click Detect USB printers and
          choose it from the browser list.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={detecting}
          onClick={() => void handleDetect()}
        >
          {detecting ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
          )}
          Detect USB printers
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => void refresh()}
        >
          Refresh list
        </Button>
      </div>
    </div>
  );
}
