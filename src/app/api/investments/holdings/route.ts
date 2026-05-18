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
      account: { select: { id: true, account_label: true, iban: true } },
      lots: { orderBy: { fecha_compra: "asc" } },
    },
    orderBy: { updated_at: "desc" },
  });

  const enriched = holdings.map((h) => {
    const precio_actual = Number(h.instrument.current_price ?? 0);
    const exchange = Number(h.instrument.exchange_rate_to_eur ?? 1);
    const totalCantidad = Number(h.total_cantidad);
    const totalInvertidoEur = Number(h.total_invertido_eur);
    const totalInvertidoOrig = Number(h.total_invertido_original);
    const valor_actual_eur = h.instrument.currency === "EUR"
      ? totalCantidad * precio_actual
      : totalCantidad * precio_actual * exchange;
    const invertido_eur = totalInvertidoEur;
    const plusvalia_no_realizada = valor_actual_eur - invertido_eur;
    const roi = invertido_eur !== 0 ? (plusvalia_no_realizada / invertido_eur) * 100 : 0;

    return {
      ...h,
      current_price: h.instrument.current_price,
      valor_actual_eur,
      plusvalia_no_realizada,
      roi,
      precio_medio: totalCantidad > 0 ? totalInvertidoOrig / totalCantidad : 0,
    };
  });

  return NextResponse.json(enriched);
}
