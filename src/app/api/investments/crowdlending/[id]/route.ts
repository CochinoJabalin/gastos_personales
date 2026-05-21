import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function serialize(inv: Awaited<ReturnType<typeof prisma.crowdlendingInvestment.findFirst>>) {
  if (!inv) return null;
  return {
    ...inv,
    cantidad: Number(inv.cantidad),
    porcentaje_beneficio: Number(inv.porcentaje_beneficio),
    roi: inv.roi ? Number(inv.roi) : null,
    beneficios_brutos: inv.beneficios_brutos ? Number(inv.beneficios_brutos) : null,
    impuestos: inv.impuestos ? Number(inv.impuestos) : null,
    beneficios_netos: inv.beneficios_netos ? Number(inv.beneficios_netos) : null,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const investment = await prisma.crowdlendingInvestment.findUnique({
    where: { id },
    include: {
      account: true,
      payments: { orderBy: { fecha: "asc" } },
    },
  });

  if (!investment) {
    return NextResponse.json({ error: "Inversión no encontrada" }, { status: 404 });
  }

  const payments = investment.payments.map((p) => ({
    ...p,
    importe: Number(p.importe),
    intereses: Number(p.intereses),
    capital: Number(p.capital),
  }));

  const capitalDevuelto = payments.reduce((s, p) => s + p.capital, 0);
  const interesesCobrados = payments.reduce((s, p) => s + p.intereses, 0);

  const mesesTotales = investment.meses_iniciales + (investment.meses_extension ?? 0);
  const interesesEsperados =
    Number(investment.cantidad) *
    (Number(investment.porcentaje_beneficio) / 100) *
    (mesesTotales / 12);

  return NextResponse.json({
    ...serialize(investment),
    payments,
    account: investment.account
      ? { id: investment.account.id, account_label: investment.account.account_label }
      : null,
    capital_pendiente: Math.max(0, Number(investment.cantidad) - capitalDevuelto),
    intereses_pendientes: Math.max(0, interesesEsperados - interesesCobrados),
    total_retornado: payments.reduce((s, p) => s + p.importe, 0),
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  // If marking as MATURED, calculate final KPIs
  if (body.status === "MATURED") {
    const inv = await prisma.crowdlendingInvestment.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (inv) {
      const interesesCobrados = inv.payments.reduce((s, p) => s + Number(p.intereses), 0);
      const beneficiosBrutos = interesesCobrados;
      const impuestos = beneficiosBrutos * 0.19;
      const beneficiosNetos = beneficiosBrutos - impuestos;
      const cantidad = Number(inv.cantidad);
      const roi = cantidad > 0 ? (beneficiosNetos / cantidad) * 100 : 0;

      body.roi = roi;
      body.beneficios_brutos = beneficiosBrutos;
      body.impuestos = impuestos;
      body.beneficios_netos = beneficiosNetos;
      body.fecha_fin = body.fecha_fin || new Date().toISOString();
    }
  }

  const investment = await prisma.crowdlendingInvestment.update({
    where: { id },
    data: {
      descripcion: body.descripcion,
      meses_extension: body.meses_extension,
      status: body.status,
      originador: body.originador,
      fecha_fin: body.fecha_fin ? new Date(body.fecha_fin) : undefined,
      roi: body.roi,
      beneficios_brutos: body.beneficios_brutos,
      impuestos: body.impuestos,
      beneficios_netos: body.beneficios_netos,
    },
  });

  return NextResponse.json(serialize(investment));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const investment = await prisma.crowdlendingInvestment.findUnique({
    where: { id },
    include: { payments: true },
  });

  if (!investment) {
    return NextResponse.json({ error: "Inversión no encontrada" }, { status: 404 });
  }

  // Reverse all payment transactions
  for (const payment of investment.payments) {
    if (payment.created_transaction_id) {
      const tx = await prisma.transaction.findUnique({
        where: { id: payment.created_transaction_id },
      });
      if (tx) {
        await prisma.transaction.delete({ where: { id: payment.created_transaction_id } });
        if (tx.account_id) {
          await prisma.account.update({
            where: { id: tx.account_id },
            data: { balance: { decrement: tx.amount } },
          });
        }
        await prisma.bank.update({
          where: { id: tx.bank_id },
          data: { balance: { decrement: tx.amount } },
        });
      }
    }
  }

  // Delete all payments
  await prisma.crowdlendingPayment.deleteMany({
    where: { investment_id: id },
  });

  // Reverse initial transaction
  const initTx = await prisma.transaction.findFirst({
    where: { crowdlending_investment_id: id },
  });
  if (initTx) {
    await prisma.transaction.delete({ where: { id: initTx.id } });
    if (initTx.account_id) {
      await prisma.account.update({
        where: { id: initTx.account_id },
        data: { balance: { decrement: initTx.amount } },
      });
    }
    await prisma.bank.update({
      where: { id: initTx.bank_id },
      data: { balance: { decrement: initTx.amount } },
    });
  }

  await prisma.crowdlendingInvestment.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
