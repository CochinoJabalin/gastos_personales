import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const investment = await prisma.crowdlendingInvestment.findUnique({
    where: { id },
  });

  if (!investment) {
    return NextResponse.json({ error: "Inversión no encontrada" }, { status: 404 });
  }

  const payments = await prisma.crowdlendingPayment.findMany({
    where: { investment_id: id },
    orderBy: { fecha: "asc" },
  });

  return NextResponse.json(
    payments.map((p) => ({
      ...p,
      importe: Number(p.importe),
      intereses: Number(p.intereses),
      capital: Number(p.capital),
    }))
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const investment = await prisma.crowdlendingInvestment.findUnique({
    where: { id },
    include: { account: true },
  });

  if (!investment) {
    return NextResponse.json({ error: "Inversión no encontrada" }, { status: 404 });
  }

  const payment = await prisma.crowdlendingPayment.create({
    data: {
      investment_id: id,
      fecha: new Date(body.fecha),
      importe: body.importe,
      intereses: body.intereses,
      capital: body.capital,
      comentarios: body.comentarios || null,
    },
  });

  // If linked to an account, create a transaction and update balances
  let createdTransactionId: string | null = null;
  if (investment.account_id) {
    const amount = Math.abs(Number(body.importe));
    const tx = await prisma.transaction.create({
      data: {
        concept: `Pago Crownlending: ${investment.descripcion}`,
        amount,
        bank_id: investment.account!.bank_id,
        account_id: investment.account_id,
        group: "Inversión",
        type: "Variable",
        timestamp: new Date(body.fecha),
        crowdlending_investment_id: id,
        comentarios: `Intereses: ${Number(body.intereses).toFixed(2)}€ / Capital: ${Number(body.capital).toFixed(2)}€`,
      },
    });
    createdTransactionId = tx.id;

    await prisma.account.update({
      where: { id: investment.account_id },
      data: { balance: { increment: amount } },
    });

    await prisma.bank.update({
      where: { id: investment.account!.bank_id },
      data: { balance: { increment: amount } },
    });
  }

  if (createdTransactionId) {
    await prisma.crowdlendingPayment.update({
      where: { id: payment.id },
      data: { created_transaction_id: createdTransactionId },
    });
  }

  const result = await prisma.crowdlendingPayment.findUnique({
    where: { id: payment.id },
  });

  return NextResponse.json(
    {
      ...result,
      importe: Number(result!.importe),
      intereses: Number(result!.intereses),
      capital: Number(result!.capital),
    },
    { status: 201 }
  );
}
