import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Parse Spanish number format: "1.234,56" -> 1234.56
function parseSpanishNumber(str: string | undefined | null): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Parse percentage: "27%" or "26,50%" -> 0.27 or 0.265
function parsePercentage(str: string | undefined | null): number | null {
  if (!str) return null;
  const cleaned = str.replace("%", "").replace(",", ".").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num / 100;
}

// Parse date DD/MM/YYYY -> ISO string
function parseDate(str: string): string | null {
  const parts = str.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
}

// Normalize ticker for lookup (remove exchange prefix)
function normalizeTicker(ticker: string): string {
  // NYSE:KOS -> KOS, BME:ITX -> ITX, etc.
  if (ticker.includes(":")) {
    return ticker.split(":")[1].toUpperCase();
  }
  return ticker.toUpperCase();
}

// Normalize currency
function normalizeCurrency(currency: string | undefined | null): string {
  if (!currency) return "EUR";
  const upper = currency.toUpperCase().trim();
  if (upper === "EURO" || upper === "EUR" || upper === "€") return "EUR";
  if (upper === "DOLAR" || upper === "USD" || upper === "$") return "USD";
  if (upper === "LIBRA" || upper === "GBP" || upper === "£") return "GBP";
  return upper;
}

export interface DividendPreviewRow {
  line: number;
  fecha: string;
  fechaISO: string;
  isin: string | null;
  ticker: string | null;
  nombre: string;
  titulos: number;
  dividendoPorTitulo: number | null;
  divisa: string;
  importeBrutoOrig: number | null;
  tipoCambio: number | null;
  importeBrutoEur: number | null;
  retencionOrigenPct: number | null;
  retencionEspPct: number | null;
  importeNetoEur: number;
  instrumentId: string | null;
  instrumentName: string | null;
  instrumentExists: boolean;
  duplicate: { id: string; date: string; importe: number } | null;
  errors: string[];
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const separator = (formData.get("separator") as string) || ";";

    if (!file) {
      return NextResponse.json({ error: "No se ha enviado ningún archivo" }, { status: 400 });
    }

    // Read file with encoding fallback
    let content: string;
    const buffer = await file.arrayBuffer();
    
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      content = new TextDecoder("latin1").decode(buffer);
    }

    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      return NextResponse.json({ error: "El archivo está vacío o no tiene datos" }, { status: 400 });
    }

    // Parse header
    const header = lines[0].split(separator).map((h) => h.trim().toLowerCase());
    
    // Expected columns (case-insensitive)
    const colFecha = header.findIndex((h) => h.includes("fecha"));
    const colIsin = header.findIndex((h) => h === "isin");
    const colTicker = header.findIndex((h) => h === "ticker");
    const colNombre = header.findIndex((h) => h.includes("nombre"));
    const colTitulos = header.findIndex((h) => h.includes("titulo"));
    const colXTitulos = header.findIndex((h) => h.includes("xtitulo"));
    const colCurrency = header.findIndex((h) => h.includes("currency") || h.includes("divisa"));
    const colBruto = header.findIndex((h, i) => h === "bruto" && i < header.lastIndexOf("bruto")); // First "Bruto" column
    const colCambio = header.findIndex((h) => h.includes("cambio"));
    const colBrutoEur = header.findIndex((h) => h.includes("bruto") && (h.includes("€") || h.includes("?") || h.includes("eur")));
    const colRetOrigen = header.findIndex((h) => h.includes("retencion") && h.includes("origen"));
    const colRetEsp = header.findIndex((h) => h === "retencion" || (h.includes("retencion") && !h.includes("origen") && !h.includes("€") && !h.includes("?")));
    const colNetoEur = header.findIndex((h) => h.includes("neto") && (h.includes("€") || h.includes("?") || h.includes("eur")));

    if (colFecha === -1 || colNetoEur === -1) {
      return NextResponse.json({ 
        error: "Columnas requeridas no encontradas. Se necesita: Fecha y Neto €" 
      }, { status: 400 });
    }

    // Get all instruments for matching
    const instruments = await prisma.investmentInstrument.findMany();
    
    // Get existing dividends for duplicate detection
    const existingDividends = await prisma.investmentTransaction.findMany({
      where: { type: "DIVIDEND" },
      select: { id: true, instrument_id: true, date: true, importe_eur: true },
    });

    const rows: DividendPreviewRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(separator);
      if (cols.length < 2) continue;

      const errors: string[] = [];
      
      // Parse date
      const fechaRaw = cols[colFecha]?.trim() || "";
      const fechaISO = parseDate(fechaRaw);
      if (!fechaISO) {
        errors.push(`Fecha inválida: ${fechaRaw}`);
      }

      // Parse ISIN and Ticker
      const isin = cols[colIsin]?.trim() || null;
      const tickerRaw = cols[colTicker]?.trim() || null;
      const ticker = tickerRaw ? normalizeTicker(tickerRaw) : null;
      const tickerWithPrefix = tickerRaw; // Keep original for display
      
      // Parse name
      const nombre = cols[colNombre]?.trim() || "";

      // Parse amounts
      const titulos = parseSpanishNumber(cols[colTitulos]) || 0;
      const dividendoPorTitulo = colXTitulos !== -1 ? parseSpanishNumber(cols[colXTitulos]) : null;
      const divisa = normalizeCurrency(cols[colCurrency]);
      const importeBrutoOrig = colBruto !== -1 ? parseSpanishNumber(cols[colBruto]) : null;
      const tipoCambio = colCambio !== -1 ? parseSpanishNumber(cols[colCambio]) : null;
      const importeBrutoEur = colBrutoEur !== -1 ? parseSpanishNumber(cols[colBrutoEur]) : null;
      const retencionOrigenPct = colRetOrigen !== -1 ? parsePercentage(cols[colRetOrigen]) : null;
      const retencionEspPct = colRetEsp !== -1 ? parsePercentage(cols[colRetEsp]) : null;
      const importeNetoEur = parseSpanishNumber(cols[colNetoEur]) || 0;

      if (importeNetoEur === 0) {
        errors.push("Importe neto es 0 o no válido");
      }

      // Find instrument
      let instrumentId: string | null = null;
      let instrumentName: string | null = null;
      let instrumentExists = false;

      // First try by ISIN
      if (isin) {
        const found = instruments.find((inst) => inst.isin === isin);
        if (found) {
          instrumentId = found.id;
          instrumentName = found.name;
          instrumentExists = true;
        }
      }
      
      // Then try by ticker (normalized)
      if (!instrumentId && ticker) {
        const found = instruments.find((inst) => {
          if (!inst.ticker) return false;
          const instTicker = normalizeTicker(inst.ticker);
          return instTicker === ticker;
        });
        if (found) {
          instrumentId = found.id;
          instrumentName = found.name;
          instrumentExists = true;
        }
      }

      // Check for duplicate: same instrument + same date + same amount (within 0.01)
      let duplicate: { id: string; date: string; importe: number } | null = null;
      if (instrumentId && fechaISO) {
        const fechaDate = new Date(fechaISO);
        const found = existingDividends.find((d) => {
          if (d.instrument_id !== instrumentId) return false;
          const dDate = new Date(d.date);
          if (dDate.toISOString().split("T")[0] !== fechaISO) return false;
          const diff = Math.abs(Number(d.importe_eur) - importeNetoEur);
          return diff < 0.02;
        });
        if (found) {
          duplicate = {
            id: found.id,
            date: (() => { const d = new Date(found.date); return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`; })(),
            importe: Number(found.importe_eur),
          };
        }
      }

      rows.push({
        line: i + 1,
        fecha: fechaRaw,
        fechaISO: fechaISO || "",
        isin,
        ticker: tickerWithPrefix,
        nombre,
        titulos,
        dividendoPorTitulo,
        divisa,
        importeBrutoOrig,
        tipoCambio,
        importeBrutoEur,
        retencionOrigenPct,
        retencionEspPct,
        importeNetoEur,
        instrumentId,
        instrumentName,
        instrumentExists,
        duplicate,
        errors,
      });
    }

    // Collect instruments that need to be created
    const missingInstruments = rows
      .filter((r) => !r.instrumentExists && (r.isin || r.ticker))
      .reduce((acc, r) => {
        const key = r.isin || r.ticker || "";
        if (!acc.has(key)) {
          acc.set(key, {
            isin: r.isin,
            ticker: r.ticker,
            name: r.nombre,
            currency: r.divisa,
          });
        }
        return acc;
      }, new Map<string, { isin: string | null; ticker: string | null; name: string; currency: string }>());

    return NextResponse.json({
      rows,
      missing_instruments: Array.from(missingInstruments.values()),
      summary: {
        total: rows.length,
        ok: rows.filter((r) => r.errors.length === 0 && r.instrumentExists && !r.duplicate).length,
        duplicates: rows.filter((r) => r.duplicate).length,
        missing_instrument: rows.filter((r) => !r.instrumentExists).length,
        with_errors: rows.filter((r) => r.errors.length > 0).length,
      },
    });
  } catch (err) {
    console.error("[Dividends Preview]", err);
    return NextResponse.json({ error: "Error procesando archivo" }, { status: 500 });
  }
}
