import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface ImportItem {
  action: "create" | "skip" | "replace";
  duplicateId?: string;
  fechaISO: string;
  operacion: "BUY" | "SELL" | "DIVIDEND";
  descripcion: string;
  ticker: string | null;
  isin: string | null;
  titulos: number;
  precioUnidad: number;
  divisa: string;
  tipoCambio: number;
  importeNetoEur: number;
  instrumentType: string;
  instrumentId: string | null;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { items, account_id } = body as {
    items: ImportItem[];
    account_id: string;
  };

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "No hay items para importar" }, { status: 400 });
  }

  // Verify account exists (MyInvestor)
  const account = await prisma.account.findUnique({
    where: { id: account_id },
    include: { bank: true },
  });

  if (!account) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  let created = 0;
  let skipped = 0;
  let replaced = 0;
  const errors: string[] = [];

  // Get all existing instruments for lookup
  const existingInstruments = await prisma.investmentInstrument.findMany();
  const instrumentByIsin = new Map(existingInstruments.filter((i) => i.isin).map((i) => [i.isin!, i]));
  const instrumentByTicker = new Map(existingInstruments.filter((i) => i.ticker).map((i) => [i.ticker!.toUpperCase(), i]));

  for (const item of items) {
    if (item.action === "skip") {
      skipped++;
      continue;
    }

    try {
      // Find or create instrument
      let instrumentId = item.instrumentId;

      if (!instrumentId) {
        // Check again in case it was created in a previous iteration
        let instrument = null;
        if (item.isin) {
          instrument = instrumentByIsin.get(item.isin);
        }
        if (!instrument && item.ticker) {
          instrument = instrumentByTicker.get(item.ticker.toUpperCase());
        }

        if (!instrument) {
          // Create new instrument
          instrument = await prisma.investmentInstrument.create({
            data: {
              ticker: item.ticker,
              isin: item.isin,
              name: item.descripcion,
              type: item.instrumentType,
              currency: item.divisa,
            },
          });
          // Add to maps for future lookups
          if (instrument.isin) instrumentByIsin.set(instrument.isin, instrument);
          if (instrument.ticker) instrumentByTicker.set(instrument.ticker.toUpperCase(), instrument);
        }
        instrumentId = instrument.id;
      }

      // Handle replace action
      if (item.action === "replace" && item.duplicateId) {
        // Delete old transaction and related lot
        const oldTx = await prisma.investmentTransaction.findUnique({
          where: { id: item.duplicateId },
          include: { holding: true },
        });

        if (oldTx) {
          // If it was a BUY, find and delete the lot
          if (oldTx.type === "BUY") {
            // Find lots created on same date with same quantity
            const lotsToDelete = await prisma.investmentLot.findMany({
              where: {
                holding_id: oldTx.holding_id,
                fecha_compra: oldTx.date,
                cantidad_original: Number(oldTx.cantidad),
              },
            });
            for (const lot of lotsToDelete) {
              await prisma.investmentLot.delete({ where: { id: lot.id } });
            }

            // Update holding totals
            if (oldTx.holding_id) {
              await prisma.investmentHolding.update({
                where: { id: oldTx.holding_id },
                data: {
                  total_cantidad: { decrement: Number(oldTx.cantidad) },
                  total_invertido_original: { decrement: Number(oldTx.importe_total) },
                  total_invertido_eur: { decrement: Number(oldTx.importe_eur) },
                },
              });
            }
          }

          await prisma.investmentTransaction.delete({ where: { id: item.duplicateId } });
        }
        replaced++;
      } else {
        created++;
      }

      // Create the transaction
      const date = new Date(item.fechaISO);
      const importeTotal = item.titulos * item.precioUnidad;
      const importeEur = item.importeNetoEur;

      if (item.operacion === "BUY") {
        await handleBuy(
          instrumentId,
          item.titulos,
          item.precioUnidad,
          importeTotal,
          importeEur,
          item.divisa,
          item.tipoCambio,
          date,
          account_id
        );
      } else if (item.operacion === "SELL") {
        await handleSell(
          instrumentId,
          item.titulos,
          item.precioUnidad,
          importeTotal,
          importeEur,
          item.divisa,
          item.tipoCambio,
          date,
          account_id
        );
      } else if (item.operacion === "DIVIDEND") {
        await handleDividend(
          instrumentId,
          item.titulos,
          item.precioUnidad,
          importeTotal,
          importeEur,
          item.divisa,
          item.tipoCambio,
          date,
          account_id
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Línea ${item.fechaISO} ${item.descripcion}: ${msg}`);
    }
  }

  return NextResponse.json({
    created,
    replaced,
    skipped,
    errors,
    total: items.length,
  });
}

async function handleBuy(
  instrument_id: string,
  cantidad: number,
  precio: number,
  importeTotal: number,
  importeEur: number,
  divisa: string,
  exchange: number,
  date: Date,
  account_id: string
) {
  // Find or create holding
  let holding = await prisma.investmentHolding.findFirst({
    where: { instrument_id, account_id },
  });

  if (!holding) {
    holding = await prisma.investmentHolding.create({
      data: {
        instrument_id,
        account_id,
        total_cantidad: 0,
        total_invertido_original: 0,
        total_invertido_eur: 0,
      },
    });
  }

  // Create transaction
  await prisma.investmentTransaction.create({
    data: {
      instrument_id,
      holding_id: holding.id,
      type: "BUY",
      cantidad,
      precio_unitario: precio,
      importe_total: importeTotal,
      importe_eur: importeEur,
      divisa,
      exchange_rate: exchange,
      date,
    },
  });

  // Create lot for FIFO
  await prisma.investmentLot.create({
    data: {
      holding_id: holding.id,
      instrument_id,
      cantidad_original: cantidad,
      cantidad_restante: cantidad,
      precio_unitario: precio,
      total_original: importeTotal,
      total_eur: importeEur,
      fecha_compra: date,
      divisa,
      exchange_rate_compra: exchange,
    },
  });

  // Update holding totals
  await prisma.investmentHolding.update({
    where: { id: holding.id },
    data: {
      total_cantidad: { increment: cantidad },
      total_invertido_original: { increment: importeTotal },
      total_invertido_eur: { increment: importeEur },
      updated_at: new Date(),
    },
  });

  // NOTE: We do NOT update account/bank balances for imports
}

async function handleSell(
  instrument_id: string,
  cantidad: number,
  precio: number,
  importeTotal: number,
  importeEur: number,
  divisa: string,
  exchange: number,
  date: Date,
  account_id: string
) {
  const holding = await prisma.investmentHolding.findFirst({
    where: { instrument_id, account_id },
    include: {
      lots: { where: { cantidad_restante: { gt: 0 } }, orderBy: { fecha_compra: "asc" } },
    },
  });

  if (!holding) {
    // Create holding with negative balance (adjustment will be needed)
    const newHolding = await prisma.investmentHolding.create({
      data: {
        instrument_id,
        account_id,
        total_cantidad: -cantidad,
        total_invertido_original: 0,
        total_invertido_eur: 0,
      },
    });

    await prisma.investmentTransaction.create({
      data: {
        instrument_id,
        holding_id: newHolding.id,
        type: "SELL",
        cantidad: -cantidad,
        precio_unitario: precio,
        importe_total: importeTotal,
        importe_eur: importeEur,
        divisa,
        exchange_rate: exchange,
        date,
        plusvalia_realizada_orig: 0,
        plusvalia_realizada_eur: 0,
      },
    });
    return;
  }

  // Consume lots FIFO
  let restante = cantidad;
  let plusvaliaTotalOrig = 0;
  let plusvaliaTotalEur = 0;

  for (const lot of holding.lots) {
    if (restante <= 0) break;

    const cantRest = Number(lot.cantidad_restante);
    const precioLot = Number(lot.precio_unitario);
    const consumir = Math.min(restante, cantRest);
    const costeOrig = consumir * precioLot;
    const ingresoOrig = consumir * precio;
    const plusvaliaOrig = ingresoOrig - costeOrig;
    const lotExchange = Number(lot.exchange_rate_compra);
    const plusvaliaEur = divisa === "EUR" ? plusvaliaOrig : plusvaliaOrig * exchange;

    plusvaliaTotalOrig += plusvaliaOrig;
    plusvaliaTotalEur += plusvaliaEur;

    const nuevaRestante = cantRest - consumir;

    if (nuevaRestante <= 0) {
      await prisma.investmentLot.delete({ where: { id: lot.id } });
    } else {
      await prisma.investmentLot.update({
        where: { id: lot.id },
        data: { cantidad_restante: nuevaRestante },
      });
    }

    restante -= consumir;
  }

  // Create transaction
  await prisma.investmentTransaction.create({
    data: {
      instrument_id,
      holding_id: holding.id,
      type: "SELL",
      cantidad: -cantidad,
      precio_unitario: precio,
      importe_total: importeTotal,
      importe_eur: importeEur,
      divisa,
      exchange_rate: exchange,
      date,
      plusvalia_realizada_orig: plusvaliaTotalOrig,
      plusvalia_realizada_eur: plusvaliaTotalEur,
    },
  });

  // Update holding
  const costeTotalVendido = Number(holding.total_cantidad) > 0
    ? cantidad * (Number(holding.total_invertido_original) / Number(holding.total_cantidad))
    : 0;
  const costeTotalVendidoEur = Number(holding.total_cantidad) > 0
    ? cantidad * (Number(holding.total_invertido_eur) / Number(holding.total_cantidad))
    : 0;

  await prisma.investmentHolding.update({
    where: { id: holding.id },
    data: {
      total_cantidad: { decrement: cantidad },
      total_invertido_original: { decrement: costeTotalVendido },
      total_invertido_eur: { decrement: costeTotalVendidoEur },
      updated_at: new Date(),
    },
  });

  // NOTE: We do NOT update account/bank balances for imports
}

async function handleDividend(
  instrument_id: string,
  cantidad: number,
  precio: number,
  importeTotal: number,
  importeEur: number,
  divisa: string,
  exchange: number,
  date: Date,
  account_id: string
) {
  const holding = await prisma.investmentHolding.findFirst({
    where: { instrument_id, account_id },
  });

  await prisma.investmentTransaction.create({
    data: {
      instrument_id,
      holding_id: holding?.id || null,
      type: "DIVIDEND",
      cantidad,
      precio_unitario: precio,
      importe_total: importeTotal,
      importe_eur: importeEur,
      divisa,
      exchange_rate: exchange,
      date,
      dividend_reinvested: false,
    },
  });

  // NOTE: We do NOT update account/bank balances for imports
}
