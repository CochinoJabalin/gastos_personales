import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const investments = await prisma.crowdlendingInvestment.findMany({
    include: {
      payments: { orderBy: { fecha: "asc" } },
    },
  });

  let totalInvertido = 0;
  let totalRetornado = 0;
  let interesesCobrados = 0;
  let capitalDevuelto = 0;

  for (const inv of investments) {
    const cantidad = Number(inv.cantidad);
    totalInvertido += cantidad;
    for (const p of inv.payments) {
      totalRetornado += Number(p.importe);
      interesesCobrados += Number(p.intereses);
      capitalDevuelto += Number(p.capital);
    }
  }

  const capitalPendiente = totalInvertido - capitalDevuelto;
  const beneficiosBrutos = interesesCobrados;
  const impuestos = beneficiosBrutos * 0.19;
  const beneficiosNetos = beneficiosBrutos - impuestos;
  const roiMedio = totalInvertido > 0 ? (beneficiosNetos / totalInvertido) * 100 : 0;

  const summary = {
    total_invertido: totalInvertido,
    capital_pendiente: Math.max(0, capitalPendiente),
    total_retornado: totalRetornado,
    intereses_cobrados: interesesCobrados,
    beneficios_brutos: beneficiosBrutos,
    impuestos,
    beneficios_netos: beneficiosNetos,
    roi_medio: roiMedio,
    num_inversiones: investments.length,
    activas: investments.filter((i) => i.status === "ACTIVE" || i.status === "EXTENDED").length,
    finalizadas: investments.filter((i) => i.status === "MATURED").length,
  };

  return NextResponse.json(summary);
}
