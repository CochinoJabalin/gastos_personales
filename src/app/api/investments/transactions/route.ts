import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const instrument_id = searchParams.get("instrument_id");
  const year = searchParams.get("year");

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (instrument_id) where.instrument_id = instrument_id;
  if (year) {
    const y = parseInt(year);
    where.date = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
  }

  const transactions = await prisma.investmentTransaction.findMany({
    where,
    include: {
      instrument: { select: { ticker: true, name: true, currency: true } },
      holding: { select: { id: true } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(transactions);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { type, instrument_id, cantidad, precio_unitario, divisa, exchange_rate, date, account_id, comentarios, dividend_reinvested, is_recurring, recurring_period } = body;

  // Validate account_id is required for manual operations
  if (!account_id) {
    return NextResponse.json({ error: "Debes seleccionar una cuenta bancaria para registrar la operación" }, { status: 400 });
  }

  const cantidadNum = Number(cantidad);
  const precioNum = Number(precio_unitario);
  const exchangeNum = Number(exchange_rate || 1);
  const importeTotal = cantidadNum * precioNum;
  const importeEur = divisa === "EUR" ? importeTotal : importeTotal / exchangeNum;

  if (type === "BUY") {
    return handleBuy(instrument_id, cantidadNum, precioNum, importeTotal, importeEur, divisa, exchangeNum, date, account_id, comentarios, is_recurring, recurring_period);
  } else if (type === "SELL") {
    return handleSell(instrument_id, cantidadNum, precioNum, importeTotal, importeEur, divisa, exchangeNum, date, account_id, comentarios);
  } else if (type === "DIVIDEND") {
    return handleDividend(instrument_id, cantidadNum, precioNum, importeTotal, importeEur, divisa, exchangeNum, date, account_id, comentarios, dividend_reinvested);
  }

  return NextResponse.json({ error: "Tipo de operación no válido" }, { status: 400 });
}

async function handleBuy(
  instrument_id: string, cantidad: number, precio: number,
  importeTotal: number, importeEur: number, divisa: string, exchange: number,
  date: string, account_id: string | undefined, comentarios: string | undefined,
  is_recurring: boolean | undefined, recurring_period: string | undefined
) {
  let holding = await prisma.investmentHolding.findFirst({
    where: { instrument_id, account_id: account_id || null },
  });

  if (!holding) {
    holding = await prisma.investmentHolding.create({
      data: {
        instrument_id,
        account_id: account_id || null,
        total_cantidad: 0,
        total_invertido_original: 0,
        total_invertido_eur: 0,
      },
    });
  }

  const invTx = await prisma.investmentTransaction.create({
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
      date: new Date(date),
      is_recurring: is_recurring || false,
      recurring_period: recurring_period || null,
      comentarios,
    },
  });

  await prisma.investmentLot.create({
    data: {
      holding_id: holding.id,
      instrument_id,
      cantidad_original: cantidad,
      cantidad_restante: cantidad,
      precio_unitario: precio,
      total_original: importeTotal,
      total_eur: importeEur,
      fecha_compra: new Date(date),
      divisa,
      exchange_rate_compra: exchange,
    },
  });

  await prisma.investmentHolding.update({
    where: { id: holding.id },
    data: {
      total_cantidad: { increment: cantidad },
      total_invertido_original: { increment: importeTotal },
      total_invertido_eur: { increment: importeEur },
      updated_at: new Date(),
    },
  });

  if (account_id) {
    const account = await prisma.account.findUnique({ where: { id: account_id } });
    if (account) {
      await prisma.transaction.create({
        data: {
          concept: `Compra ${cantidad}u ${(await getTicker(instrument_id))}`,
          amount: -importeEur,
          bank_id: account.bank_id,
          account_id,
          group: "Inversión",
          type: "Variable",
          timestamp: new Date(date),
          comentarios: comentarios || null,
          investment_transaction_id: invTx.id,
        },
      });

      await prisma.account.update({
        where: { id: account_id },
        data: { balance: { decrement: importeEur } },
      });
      await prisma.bank.update({
        where: { id: account.bank_id },
        data: { balance: { decrement: importeEur } },
      });
    }
  }

  return NextResponse.json(invTx, { status: 201 });
}

async function handleSell(
  instrument_id: string, cantidad: number, precio: number,
  importeTotal: number, importeEur: number, divisa: string, exchange: number,
  date: string, account_id: string | undefined, comentarios: string | undefined
) {
  const holding = await prisma.investmentHolding.findFirst({
    where: { instrument_id, account_id: account_id || null },
    include: {
      lots: { where: { cantidad_restante: { gt: 0 } }, orderBy: { fecha_compra: "asc" } },
    },
  });

  if (!holding || Number(holding.total_cantidad) < cantidad) {
    return NextResponse.json({ error: "Cantidad insuficiente en el holding" }, { status: 400 });
  }

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
    const plusvaliaEur = plusvaliaOrig / exchange;

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

  const invTx = await prisma.investmentTransaction.create({
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
      date: new Date(date),
      plusvalia_realizada_orig: plusvaliaTotalOrig,
      plusvalia_realizada_eur: plusvaliaTotalEur,
      comentarios,
    },
  });

  const costeTotalVendido = cantidad * (Number(holding.total_invertido_original) / Number(holding.total_cantidad));
  const costeTotalVendidoEur = cantidad * (Number(holding.total_invertido_eur) / Number(holding.total_cantidad));

  await prisma.investmentHolding.update({
    where: { id: holding.id },
    data: {
      total_cantidad: { decrement: cantidad },
      total_invertido_original: { decrement: costeTotalVendido },
      total_invertido_eur: { decrement: costeTotalVendidoEur },
      updated_at: new Date(),
    },
  });

  if (account_id) {
    const account = await prisma.account.findUnique({ where: { id: account_id } });
    if (account) {
      const ticker = await getTicker(instrument_id);
      await prisma.transaction.create({
        data: {
          concept: `Venta ${cantidad}u ${ticker}`,
          amount: importeEur,
          bank_id: account.bank_id,
          account_id,
          group: "Inversión",
          type: "Variable",
          timestamp: new Date(date),
          comentarios: `Plusvalía: ${plusvaliaTotalEur.toFixed(2)} EUR`,
          investment_transaction_id: invTx.id,
        },
      });

      await prisma.account.update({
        where: { id: account_id },
        data: { balance: { increment: importeEur } },
      });
      await prisma.bank.update({
        where: { id: account.bank_id },
        data: { balance: { increment: importeEur } },
      });
    }
  }

  return NextResponse.json(invTx, { status: 201 });
}

async function handleDividend(
  instrument_id: string, cantidad: number, precio: number,
  importeTotal: number, importeEur: number, divisa: string, exchange: number,
  date: string, account_id: string | undefined, comentarios: string | undefined,
  dividend_reinvested: boolean | undefined
) {
  const holding = await prisma.investmentHolding.findFirst({
    where: { instrument_id, account_id: account_id || null },
  });

  const invTx = await prisma.investmentTransaction.create({
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
      date: new Date(date),
      dividend_reinvested: dividend_reinvested || false,
      comentarios,
    },
  });

  if (dividend_reinvested && holding) {
    const unidadesExtra = importeEur / precio;
    const costeExtraOrig = unidadesExtra * precio;

    await prisma.investmentLot.create({
      data: {
        holding_id: holding.id,
        instrument_id,
        cantidad_original: unidadesExtra,
        cantidad_restante: unidadesExtra,
        precio_unitario: precio,
        total_original: costeExtraOrig,
        total_eur: importeEur,
        fecha_compra: new Date(date),
        divisa,
        exchange_rate_compra: exchange,
      },
    });

    await prisma.investmentHolding.update({
      where: { id: holding.id },
      data: {
        total_cantidad: { increment: unidadesExtra },
        total_invertido_original: { increment: costeExtraOrig },
        total_invertido_eur: { increment: importeEur },
        updated_at: new Date(),
      },
    });
  } else if (account_id) {
    const account = await prisma.account.findUnique({ where: { id: account_id } });
    if (account) {
      await prisma.transaction.create({
        data: {
          concept: `Dividendo ${(await getTicker(instrument_id))}`,
          amount: importeEur,
          bank_id: account.bank_id,
          account_id,
          group: "Dividendos",
          type: "Variable",
          timestamp: new Date(date),
          comentarios: comentarios || null,
          investment_transaction_id: invTx.id,
        },
      });

      await prisma.account.update({
        where: { id: account_id },
        data: { balance: { increment: importeEur } },
      });
      await prisma.bank.update({
        where: { id: account.bank_id },
        data: { balance: { increment: importeEur } },
      });
    }
  }

  return NextResponse.json(invTx, { status: 201 });
}

async function getTicker(instrument_id: string): Promise<string> {
  const inst = await prisma.investmentInstrument.findUnique({
    where: { id: instrument_id },
    select: { ticker: true },
  });
  return inst?.ticker || "???";
}
