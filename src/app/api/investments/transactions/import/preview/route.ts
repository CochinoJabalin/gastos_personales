import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseSpanishNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

// Normalize currency names
function normalizeCurrency(currency: string): string {
  const c = currency.toLowerCase().trim();
  if (c === "euro" || c === "eur" || c === "€") return "EUR";
  if (c === "dolar" || c === "dollar" || c === "usd" || c === "$") return "USD";
  if (c === "gbp" || c === "libra" || c === "£") return "GBP";
  return currency.toUpperCase();
}

// Normalize operation type
function normalizeOperation(op: string): "BUY" | "SELL" | "DIVIDEND" {
  const o = op.toLowerCase().trim();
  if (o === "compra" || o === "buy") return "BUY";
  if (o === "venta" || o === "sell") return "SELL";
  return "DIVIDEND";
}

// Detect instrument type from description
function detectInstrumentType(description: string): string {
  const d = description.toUpperCase();
  if (d.includes("DERECHOS")) return "RIGHT";
  if (d.includes("ETF")) return "ETF";
  if (d.includes("ETC") || d.includes("PHYSICAL")) return "ETC";
  if (d.includes("FUND") || d.includes("FONDO")) return "FUND";
  return "STOCK";
}

// Parse date DD/MM/YYYY to Date
function parseDate(dateStr: string): Date | null {
  const parts = dateStr.split(/[/\-]/);
  if (parts.length !== 3) return null;
  const [day, month, yearStr] = parts.map((p) => parseInt(p, 10));
  if (!day || !month || !yearStr || day > 31 || month > 12) return null;
  const year = yearStr < 100 ? 2000 + yearStr : yearStr;
  const date = new Date(year, month - 1, day);
  return isNaN(date.getTime()) ? null : date;
}

interface ParsedRow {
  line: number;
  fecha: string;
  fechaObj: Date;
  operacion: "BUY" | "SELL" | "DIVIDEND";
  descripcion: string;
  ticker: string | null;
  isin: string | null;
  titulos: number;
  importeBrutoDivisa: number;
  precioUnidad: number;
  divisa: string;
  comisionDivisa: number;
  tipoCambio: number;
  importeNetoEur: number;
  instrumentType: string;
  instrumentExists: boolean;
  instrumentId: string | null;
  duplicate: { id: string; date: string; cantidad: number } | null;
  errors: string[];
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const separator = (formData.get("separator") as string) || ";";

  if (!file) {
    return NextResponse.json({ error: "Falta el archivo CSV" }, { status: 400 });
  }

  // Read and decode file
  const buffer = await file.arrayBuffer();
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder("latin1").decode(buffer);
  }

  const lines = text.split("\n").filter((line) => line.trim());
  if (lines.length < 2) {
    return NextResponse.json({ error: "El CSV está vacío o solo tiene cabecera" }, { status: 400 });
  }

  // Parse header
  const headers = lines[0].toLowerCase().split(separator).map((h) => h.trim());
  
  // Find column indices
  const fechaIdx = headers.findIndex((h) => h.includes("fecha"));
  const operacionIdx = headers.findIndex((h) => h.includes("operaci"));
  const descripcionIdx = headers.findIndex((h) => h.includes("descripci"));
  const tickerIdx = headers.findIndex((h) => h.includes("ticker"));
  const isinIdx = headers.findIndex((h) => h.includes("isin"));
  const titulosIdx = headers.findIndex((h) => h.includes("tulos") || h.includes("titulos"));
  const importeBrutoIdx = headers.findIndex((h) => h.includes("importe bruto") && h.includes("divisa"));
  const precioIdx = headers.findIndex((h) => h.includes("precio"));
  const divisaIdx = headers.findIndex((h) => h === "divisa" || h.includes("divisa"));
  const comisionIdx = headers.findIndex((h, i) => h.includes("comision") && !headers[i].includes("€") && !headers[i].includes("?"));
  const tipoCambioIdx = headers.findIndex((h) => h.includes("tipo de cambio") || h.includes("cambio"));

  // Validate required columns
  const requiredCols = [
    { idx: fechaIdx, name: "Fecha" },
    { idx: operacionIdx, name: "Operación" },
    { idx: descripcionIdx, name: "Descripción" },
    { idx: isinIdx, name: "ISIN" },
    { idx: titulosIdx, name: "Número de Títulos" },
    { idx: importeBrutoIdx, name: "Importe Bruto en divisa" },
    { idx: divisaIdx, name: "Divisa" },
  ];

  const missingCols = requiredCols.filter((c) => c.idx === -1).map((c) => c.name);
  if (missingCols.length > 0) {
    return NextResponse.json({
      error: `Faltan columnas requeridas: ${missingCols.join(", ")}`,
    }, { status: 400 });
  }

  // Get all existing instruments
  const existingInstruments = await prisma.investmentInstrument.findMany();
  const instrumentByIsin = new Map(existingInstruments.filter((i) => i.isin).map((i) => [i.isin!, i]));
  const instrumentByTicker = new Map(existingInstruments.filter((i) => i.ticker).map((i) => [i.ticker!.toUpperCase(), i]));

  // Parse rows
  const rows: ParsedRow[] = [];
  const newInstrumentsMap = new Map<string, { ticker: string | null; isin: string | null; name: string; currency: string; type: string }>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator).map((c) => c.trim().replace(/^["']|["']$/g, ""));
    if (cols.length < Math.max(fechaIdx, operacionIdx, descripcionIdx, isinIdx, titulosIdx, importeBrutoIdx, divisaIdx)) {
      continue;
    }

    const errors: string[] = [];

    // Parse fields
    const fechaStr = cols[fechaIdx];
    const fechaObj = parseDate(fechaStr);
    if (!fechaObj) {
      errors.push(`Fecha inválida: ${fechaStr}`);
    }

    const operacion = normalizeOperation(cols[operacionIdx]);
    const descripcion = cols[descripcionIdx];
    const ticker = tickerIdx !== -1 && cols[tickerIdx] ? cols[tickerIdx].trim() : null;
    const isin = cols[isinIdx] ? cols[isinIdx].trim() : null;
    const titulos = parseSpanishNumber(cols[titulosIdx]);
    const importeBrutoDivisa = parseSpanishNumber(cols[importeBrutoIdx]);
    const divisa = normalizeCurrency(cols[divisaIdx] || "EUR");
    const comisionDivisa = comisionIdx !== -1 ? parseSpanishNumber(cols[comisionIdx] || "0") : 0;
    const tipoCambio = tipoCambioIdx !== -1 ? parseSpanishNumber(cols[tipoCambioIdx] || "1") : 1;

    if (!isin && !ticker) {
      errors.push("Se requiere al menos ISIN o Ticker");
    }

    if (isNaN(titulos) || titulos <= 0) {
      errors.push(`Número de títulos inválido: ${cols[titulosIdx]}`);
    }

    if (isNaN(importeBrutoDivisa)) {
      errors.push(`Importe bruto inválido: ${cols[importeBrutoIdx]}`);
    }

    // Calculate price per unit including commission
    const importeTotalDivisa = importeBrutoDivisa + comisionDivisa;
    const precioUnidad = titulos > 0 ? importeTotalDivisa / titulos : 0;

    // Calculate EUR amount
    // tipoCambio in CSV is: EUR = divisa * tipoCambio (for USD it's ~0.86)
    const importeNetoEur = divisa === "EUR" ? importeTotalDivisa : importeTotalDivisa * tipoCambio;

    // Detect instrument type
    const instrumentType = detectInstrumentType(descripcion);

    // Check if instrument exists
    let instrumentExists = false;
    let instrumentId: string | null = null;
    
    if (isin && instrumentByIsin.has(isin)) {
      instrumentExists = true;
      instrumentId = instrumentByIsin.get(isin)!.id;
    } else if (ticker && instrumentByTicker.has(ticker.toUpperCase())) {
      instrumentExists = true;
      instrumentId = instrumentByTicker.get(ticker.toUpperCase())!.id;
    }

    // Track new instruments
    if (!instrumentExists && (isin || ticker)) {
      const key = isin || ticker!;
      if (!newInstrumentsMap.has(key)) {
        newInstrumentsMap.set(key, {
          ticker,
          isin,
          name: descripcion,
          currency: divisa,
          type: instrumentType,
        });
      }
    }

    rows.push({
      line: i,
      fecha: fechaStr,
      fechaObj: fechaObj || new Date(),
      operacion,
      descripcion,
      ticker,
      isin,
      titulos,
      importeBrutoDivisa,
      precioUnidad,
      divisa,
      comisionDivisa,
      tipoCambio,
      importeNetoEur,
      instrumentType,
      instrumentExists,
      instrumentId,
      duplicate: null, // Will be filled below
      errors,
    });
  }

  // Detect duplicates: same date + ISIN/ticker + quantity + operation
  const existingTransactions = await prisma.investmentTransaction.findMany({
    where: {
      date: {
        gte: new Date(Math.min(...rows.map((r) => r.fechaObj.getTime()))),
        lte: new Date(Math.max(...rows.map((r) => r.fechaObj.getTime())) + 86400000),
      },
    },
    include: {
      instrument: { select: { isin: true, ticker: true } },
    },
  });

  for (const row of rows) {
    for (const tx of existingTransactions) {
      const sameDate = tx.date.toISOString().split("T")[0] === row.fechaObj.toISOString().split("T")[0];
      const sameIsin = row.isin && tx.instrument.isin === row.isin;
      const sameTicker = row.ticker && tx.instrument.ticker?.toUpperCase() === row.ticker.toUpperCase();
      const sameCantidad = Math.abs(Number(tx.cantidad)) === row.titulos;
      const sameType = tx.type === row.operacion;

      if (sameDate && (sameIsin || sameTicker) && sameCantidad && sameType) {
        row.duplicate = {
          id: tx.id,
          date: tx.date.toISOString().split("T")[0],
          cantidad: Number(tx.cantidad),
        };
        break;
      }
    }
  }

  const newInstruments = Array.from(newInstrumentsMap.values());

  return NextResponse.json({
    rows: rows.map((r) => ({
      line: r.line,
      fecha: r.fecha,
      fechaISO: r.fechaObj.toISOString().split("T")[0],
      operacion: r.operacion,
      descripcion: r.descripcion,
      ticker: r.ticker,
      isin: r.isin,
      titulos: r.titulos,
      precioUnidad: Math.round(r.precioUnidad * 100) / 100,
      divisa: r.divisa,
      comisionDivisa: r.comisionDivisa,
      tipoCambio: r.tipoCambio,
      importeNetoEur: Math.round(r.importeNetoEur * 100) / 100,
      instrumentType: r.instrumentType,
      instrumentExists: r.instrumentExists,
      instrumentId: r.instrumentId,
      duplicate: r.duplicate,
      errors: r.errors,
    })),
    new_instruments: newInstruments,
    total_rows: rows.length,
    has_duplicates: rows.some((r) => r.duplicate),
    has_errors: rows.some((r) => r.errors.length > 0),
  });
}
