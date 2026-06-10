/** Trailing characters of a Firestore id for compact display (non-user-facing). */
export function shortOrderId(id: string, length = 8): string {
  if (!id) return "—";
  if (id.length <= length) return id;
  return id.slice(-length);
}
