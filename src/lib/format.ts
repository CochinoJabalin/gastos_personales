export function parseSpanishNumber(value: string): number {
  let s = value.replace(/[€$]/g, "").trim();
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  return parseFloat(s);
}

/**
 * Format a number with Spanish decimal notation (comma as decimal, dot as thousands).
 * Always outputs 2 decimal places.
 */
export function formatSpanish(value: number): string {
  return fmtEs(value, 2);
}

/**
 * Format a number with Spanish locale: dot as thousands separator, comma as decimal.
 * @param decimals - number of decimal places (default: 0 for integers, 2 for fractional)
 */
export function fmtEs(value: number, decimals?: number): string {
  const d = decimals !== undefined ? decimals : (Number.isInteger(value) ? 0 : 2);
  const fixed = Math.abs(value).toFixed(d);
  const [intPart, decPart] = fixed.split(".");
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = value < 0 ? "-" : "";
  if (d === 0) return `${sign}${intFormatted}`;
  return `${sign}${intFormatted},${decPart}`;
}

/**
 * Format a date as dd/mm/yyyy with zero-padded day and month.
 */
export function fmtDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function isIncome(group: string): boolean {
  const g = group.toLowerCase();
  return g.includes("ingreso") || g === "ahorro" || g === "myinvestor";
}

export function applySign(amount: number, group: string): number {
  return isIncome(group) ? Math.abs(amount) : -Math.abs(amount);
}
