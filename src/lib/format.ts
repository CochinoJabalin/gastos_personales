export function parseSpanishNumber(value: string): number {
  let s = value.replace(/[€$]/g, "").trim();
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  return parseFloat(s);
}

export function formatSpanish(value: number): string {
  return value.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function isIncome(group: string): boolean {
  const g = group.toLowerCase();
  return g.includes("ingreso") || g === "ahorro" || g === "myinvestor";
}

export function applySign(amount: number, group: string): number {
  return isIncome(group) ? Math.abs(amount) : -Math.abs(amount);
}
