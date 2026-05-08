/**
 * Badge / chip text for a floor-plan table (avoids "Table Table 6" when label is already "Table 6").
 */
export function tableChipDisplayText(label: string): string {
  const t = label.trim();
  if (!t) return "Table";
  if (/^table(\s|$)/i.test(t)) return t;
  return `Table ${t}`;
}
