import { format } from "date-fns";
import type { Sale } from "@/lib/types";
import { formatPickupNumber } from "@/lib/pickup-number";
import { displayOrderNumber } from "@/lib/order-number";
import { saleServiceLabel } from "@/lib/order-service-label";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function itemsHtml(sale: Sale): string {
  return sale.items
    .map((item) => {
      const line = `${item.quantity}× ${escapeHtml(item.name)}`;
      const config =
        item.configuration?.length ?
          `<div class="config">${item.configuration.map((c) => `· ${escapeHtml(c.name)} ×${c.quantity}`).join("<br/>")}</div>`
        : "";
      return `<div class="line"><span>${line}</span><span>₱${(item.price * item.quantity).toFixed(2)}</span></div>${config}`;
    })
    .join("");
}

function baseStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ui-monospace, monospace; font-size: 12px; line-height: 1.35; color: #000; padding: 8px; max-width: 280px; }
    h1 { font-size: 28px; font-weight: 800; text-align: center; margin: 8px 0; }
    h2 { font-size: 14px; font-weight: 700; text-align: center; margin-bottom: 6px; }
    .meta { text-align: center; font-size: 11px; margin-bottom: 8px; }
    .line { display: flex; justify-content: space-between; gap: 8px; margin: 4px 0; }
    .config { font-size: 10px; padding-left: 8px; color: #444; margin-bottom: 4px; }
    .total { border-top: 1px dashed #000; margin-top: 8px; padding-top: 6px; font-weight: 700; font-size: 14px; }
    .badge { text-align: center; font-size: 11px; font-weight: 600; margin: 4px 0; }
  `;
}

export function buildKitchenTicketHtml(sale: Sale): string {
  const service = saleServiceLabel(sale) === "dine-in" ? "DINE IN" : "TAKEOUT";
  const pickup = formatPickupNumber(sale.pickupNumber);
  const ref = displayOrderNumber(sale.orderNumber, sale.id);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${baseStyles()}</style></head><body>
    <h2>KITCHEN</h2>
    <h1>#${pickup}</h1>
    <div class="badge">${service}</div>
    <div class="meta">${format(sale.createdAt, "MMM d, h:mm a")} · Ref ${ref}</div>
    ${itemsHtml(sale)}
    ${sale.specialInstructions ? `<div class="meta" style="margin-top:8px;text-align:left"><strong>Note:</strong> ${escapeHtml(sale.specialInstructions)}</div>` : ""}
  </body></html>`;
}

export function buildCashierReceiptHtml(sale: Sale): string {
  const service = saleServiceLabel(sale) === "dine-in" ? "Dine-in" : "Takeout";
  const pickup = formatPickupNumber(sale.pickupNumber);
  const ref = displayOrderNumber(sale.orderNumber, sale.id);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${baseStyles()}</style></head><body>
    <h2>El Rio</h2>
    <h1>#${pickup}</h1>
    <div class="badge">${service} · ${sale.paymentMethod}</div>
    <div class="meta">${format(sale.createdAt, "MMM d, yyyy h:mm a")}<br/>Ref ${ref}</div>
    ${itemsHtml(sale)}
    <div class="line"><span>Subtotal</span><span>₱${sale.subtotal.toFixed(2)}</span></div>
    ${sale.discount > 0 ? `<div class="line"><span>Discount</span><span>-₱${sale.discount.toFixed(2)}</span></div>` : ""}
    <div class="line total"><span>Total</span><span>₱${sale.total.toFixed(2)}</span></div>
    <div class="line"><span>Paid</span><span>₱${sale.amountPaid.toFixed(2)}</span></div>
    <div class="meta" style="margin-top:12px">Thank you!</div>
  </body></html>`;
}
