import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function computeKPIs(inv: {
  cantidad: number;
  porcentaje_beneficio: number;
  meses_iniciales: number;
  meses_extension: number | null;
  payments: Array<{ importe: number; intereses: number; capital: number }>;
}) {
  const mesesTotales = inv.meses_iniciales + (inv.meses_extension ?? 0);
  const capitalDevuelto = inv.payments.reduce((s, p) => s + p.capital, 0);
  const interesesCobrados = inv.payments.reduce((s, p) => s + p.intereses, 0);
  const totalRetornado = inv.payments.reduce((s, p) => s + p.importe, 0);
  const totalEsperado = inv.cantidad + inv.cantidad * (inv.porcentaje_beneficio / 100) * (mesesTotales / 12);
  const interesesEsperados = inv.cantidad * (inv.porcentaje_beneficio / 100) * (mesesTotales / 12);

  return {
    capital_pendiente: inv.cantidad - capitalDevuelto,
    intereses_pendientes: Math.max(0, interesesEsperados - interesesCobrados),
    total_retornado: totalRetornado,
    total_esperado: totalEsperado,
    intereses_cobrados: interesesCobrados,
    capital_devuelto: capitalDevuelto,
  };
}

function serialize(inv: Awaited<ReturnType<typeof prisma.crowdlendingInvestment.findFirst>>) {
  if (!inv) return null;
  const invPlain = {
    ...inv,
    cantidad: Number(inv.cantidad),
    porcentaje_beneficio: Number(inv.porcentaje_beneficio),
    roi: inv.roi ? Number(inv.roi) : null,
    beneficios_brutos: inv.beneficios_brutos ? Number(inv.beneficios_brutos) : null,
    impuestos: inv.impuestos ? Number(inv.impuestos) : null,
    beneficios_netos: inv.beneficios_netos ? Number(inv.beneficios_netos) : null,
  };
  return invPlain;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const originador = searchParams.get("originador");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (originador) where.originador = originador;

  const investments = await prisma.crowdlendingInvestment.findMany({
    where,
    include: {
      account: true,
      payments: { orderBy: { fecha: "asc" } },
    },
    orderBy: { fecha_inicio: "desc" },
  });

  const result = investments.map((inv) => {
    const payments = inv.payments.map((p) => ({
      ...p,
      importe: Number(p.importe),
      intereses: Number(p.intereses),
      capital: Number(p.capital),
    }));
    return {
      ...serialize(inv),
      payments,
      kpis: computeKPIs({
        cantidad: Number(inv.cantidad),
        porcentaje_beneficio: Number(inv.porcentaje_beneficio),
        meses_iniciales: inv.meses_iniciales,
        meses_extension: inv.meses_extension,
        payments,
      }),
      account: inv.account
        ? { id: inv.account.id, account_label: inv.account.account_label }
        : null,
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();

  const investment = await prisma.crowdlendingInvestment.create({
    data: {
      account_id: body.account_id || null,
      fecha_inicio: new Date(body.fecha_inicio),
      descripcion: body.descripcion,
      meses_iniciales: body.meses_iniciales,
      meses_extension: body.meses_extension || null,
      cantidad: body.cantidad,
      porcentaje_beneficio: body.porcentaje_beneficio,
      originador: body.originador,
      tipo_shared: body.tipo_shared || false,
      status: "ACTIVE",
    },
  });

  if (body.account_id) {
    const account = await prisma.account.findUnique({
      where: { id: body.account_id },
    });
    if (account) {
      const amount = -Math.abs(Number(body.cantidad));
      await prisma.transaction.create({
        data: {
          concept: `Inversión Crownlending: ${body.descripcion}`,
          amount,
          bank_id: account.bank_id,
          account_id: body.account_id,
          group: "Inversión",
          type: "Variable",
          timestamp: new Date(body.fecha_inicio),
          crowdlending_investment_id: investment.id,
        },
      });

      await prisma.account.update({
        where: { id: body.account_id },
        data: { balance: { increment: amount } },
      });

      await prisma.bank.update({
        where: { id: account.bank_id },
        data: { balance: { increment: amount } },
      });
    }
  }

  return NextResponse.json(serialize(investment), { status: 201 });
}
