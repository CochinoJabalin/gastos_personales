import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface DividendItem {
  action: "create" | "skip" | "replace";
  duplicateId?: string;
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
  // For creating new instrument
  newInstrumentType?: string;
}

interface CommitRequest {
  items: DividendItem[];
  account_id: string;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body: CommitRequest = await request.json();
    const { items, account_id } = body;

    if (!account_id) {
      return NextResponse.json({ error: "Se requiere account_id" }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No hay items para importar" }, { status: 400 });
    }

    let created = 0;
    let replaced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        if (item.action === "skip") {
          skipped++;
          continue;
        }

        // Get or create instrument
        let instrumentId = item.instrumentId;
        
        if (!instrumentId) {
          // Try to find by ISIN or ticker
          let instrument = null;
          
          if (item.isin) {
            instrument = await prisma.investmentInstrument.findFirst({
              where: { isin: item.isin },
            });
          }
          
          if (!instrument && item.ticker) {
            // Normalize ticker for search
            const tickerNormalized = item.ticker.includes(":") 
              ? item.ticker.split(":")[1].toUpperCase()
              : item.ticker.toUpperCase();
            
            instrument = await prisma.investmentInstrument.findFirst({
              where: {
                OR: [
                  { ticker: item.ticker },
                  { ticker: { endsWith: `:${tickerNormalized}` } },
                  { ticker: tickerNormalized },
                ],
              },
            });
          }
          
          if (!instrument) {
            // Create new instrument
            instrument = await prisma.investmentInstrument.create({
              data: {
                ticker: item.ticker,
                isin: item.isin,
                name: item.nombre || item.ticker || item.isin || "Desconocido",
                type: item.newInstrumentType || "STOCK",
                currency: item.divisa || "EUR",
              },
            });
          }
          
          instrumentId = instrument.id;
        }

        // Find holding for this instrument (if exists)
        const holding = await prisma.investmentHolding.findFirst({
          where: { instrument_id: instrumentId },
        });

        // Calculate retention amounts in EUR
        let retencionOrigenEur: number | null = null;
        let retencionEspEur: number | null = null;
        
        const brutoEur = item.importeBrutoEur || 
          (item.importeBrutoOrig && item.tipoCambio ? item.importeBrutoOrig * item.tipoCambio : null);
        
        if (brutoEur && item.retencionOrigenPct) {
          retencionOrigenEur = brutoEur * item.retencionOrigenPct;
        }
        
        if (brutoEur && item.retencionEspPct) {
          // Spanish retention is on the amount after origin retention
          const baseForSpanish = brutoEur - (retencionOrigenEur || 0);
          retencionEspEur = baseForSpanish * item.retencionEspPct;
        }

        // Handle replace - delete existing first
        if (item.action === "replace" && item.duplicateId) {
          await prisma.investmentTransaction.delete({
            where: { id: item.duplicateId },
          });
          replaced++;
        }

        // Create dividend transaction
        await prisma.investmentTransaction.create({
          data: {
            instrument_id: instrumentId,
            holding_id: holding?.id || null,
            type: "DIVIDEND",
            cantidad: item.titulos,
            precio_unitario: item.dividendoPorTitulo || 0,
            importe_total: item.importeNetoEur,
            importe_eur: item.importeNetoEur,
            divisa: item.divisa,
            exchange_rate: item.tipoCambio || 1,
            date: new Date(item.fechaISO),
            dividend_reinvested: false,
            // New fields for IRPF
            importe_bruto_orig: item.importeBrutoOrig,
            importe_bruto_eur: brutoEur,
            retencion_origen_pct: item.retencionOrigenPct,
            retencion_origen_eur: retencionOrigenEur,
            retencion_esp_pct: item.retencionEspPct,
            retencion_esp_eur: retencionEspEur,
            dividendo_por_titulo: item.dividendoPorTitulo,
          },
        });

        if (item.action === "create" || !item.duplicateId) {
          created++;
        }
      } catch (err) {
        console.error("[Dividend Commit] Error processing item:", err);
        errors.push(`Error en línea ${item.fechaISO}: ${err instanceof Error ? err.message : "Error desconocido"}`);
      }
    }

    return NextResponse.json({
      created,
      replaced,
      skipped,
      errors,
      total: items.length,
    });
  } catch (err) {
    console.error("[Dividends Commit]", err);
    return NextResponse.json({ error: "Error procesando importación" }, { status: 500 });
  }
}
