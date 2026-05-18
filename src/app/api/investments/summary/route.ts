import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const holdings = await prisma.investmentHolding.findMany({
    include: {
      instrument: true,
      lots: { where: { cantidad_restante: { gt: 0 } } },
    },
  });

  let valorTotal = 0;
  let invertidoTotal = 0;
  let plusvaliasNoRealizadasTotal = 0;

  const tipoAllocation: Record<string, number> = {};
  const instrumentAllocation: Record<string, { ticker: string; name: string; valor: number }> = {};

  for (const h of holdings) {
    const precioActual = Number(h.instrument.current_price ?? 0);
    const exchange = Number(h.instrument.exchange_rate_to_eur ?? 1);
    const valorEur = h.instrument.currency === "EUR"
      ? Number(h.total_cantidad) * precioActual
      : Number(h.total_cantidad) * precioActual * exchange;
    const invertidoEur = Number(h.total_invertido_eur);

    valorTotal += valorEur;
    invertidoTotal += invertidoEur;
    plusvaliasNoRealizadasTotal += (valorEur - invertidoEur);

    tipoAllocation[h.instrument.type] = (tipoAllocation[h.instrument.type] || 0) + valorEur;
    instrumentAllocation[h.instrument.id] = {
      ticker: h.instrument.ticker,
      name: h.instrument.name,
      valor: (instrumentAllocation[h.instrument.id]?.valor || 0) + valorEur,
    };
  }

  const sellTransactions = await prisma.investmentTransaction.findMany({
    where: { type: "SELL" },
  });

  let plusvaliasRealizadas = 0;
  for (const st of sellTransactions) {
    plusvaliasRealizadas += Number(st.plusvalia_realizada_eur || 0);
  }

  const dividendTransactions = await prisma.investmentTransaction.findMany({
    where: { type: "DIVIDEND", dividend_reinvested: false },
  });

  const currentYear = new Date().getFullYear();
  const dividendosAnuales = dividendTransactions
    .filter((d) => d.date.getFullYear() === currentYear)
    .reduce((sum, d) => sum + Number(d.importe_eur), 0);

  const rentabilidadTotal = invertidoTotal !== 0
    ? ((valorTotal + dividendosAnuales - invertidoTotal) / invertidoTotal) * 100
    : 0;

  const yieldCartera = invertidoTotal !== 0
    ? (dividendosAnuales / invertidoTotal) * 100
    : 0;

  return NextResponse.json({
    valor_total: Math.round(valorTotal * 100) / 100,
    total_invertido: Math.round(invertidoTotal * 100) / 100,
    rentabilidad_total: Math.round(rentabilidadTotal * 100) / 100,
    plusvalias_no_realizadas: Math.round(plusvaliasNoRealizadasTotal * 100) / 100,
    plusvalias_realizadas: Math.round(plusvaliasRealizadas * 100) / 100,
    dividendos_anuales: Math.round(dividendosAnuales * 100) / 100,
    dividend_yield: Math.round(yieldCartera * 100) / 100,
    tipo_allocation: tipoAllocation,
    instrument_allocation: Object.fromEntries(
      Object.entries(instrumentAllocation)
        .map(([k, v]) => {
          const entry: [string, { ticker: string; name: string; valor: number; peso: number }] =
            [k, { ...v, peso: valorTotal > 0 ? (v.valor / valorTotal) * 100 : 0 }];
          return entry;
        })
        .sort(([, a], [, b]) => b.valor - a.valor)
    ),
    holding_count: holdings.length,
  });
}
