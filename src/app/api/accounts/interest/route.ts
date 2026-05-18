import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const WITHHOLDING_RATE = 0.19;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { account_id } = body;
  if (!account_id) {
    return NextResponse.json({ error: "account_id requerido" }, { status: 400 });
  }

  const account = await prisma.account.findUnique({ where: { id: account_id } });
  if (!account) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  if (account.interest_period === "none" || Number(account.interest_rate) === 0) {
    return NextResponse.json({ error: "La cuenta no tiene intereses configurados" }, { status: 400 });
  }

  const rate = Number(account.interest_rate) / 100;
  const balance = Number(account.balance);
  const now = new Date();
  const lastDate = account.last_interest_date || new Date(account.created_at);
  const daysDiff = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff < 1) {
    return NextResponse.json({ error: "No ha pasado suficiente tiempo desde el último cálculo" }, { status: 400 });
  }

  let interestGross = 0;

  if (account.interest_period === "daily") {
    interestGross = balance * rate * daysDiff / 365;
  } else if (account.interest_period === "monthly") {
    const monthsDiff = daysDiff / 30.4375;
    interestGross = balance * rate * monthsDiff / 12;
  }

  if (interestGross <= 0) {
    return NextResponse.json({ error: "El interés calculado es cero o negativo" }, { status: 400 });
  }

  const withholding = interestGross * WITHHOLDING_RATE;
  const interestNet = interestGross - withholding;

  // Create a transaction for the gross interest
  const tx = await prisma.transaction.create({
    data: {
      concept: `Intereses ${account.interest_period === "daily" ? "diarios" : "mensuales"} (${account.account_label})`,
      amount: interestNet,
      bank_id: account.bank_id,
      account_id: account.id,
      group: "Ingresos",
      type: "Variable",
      is_recurring: false,
      timestamp: now,
      comentarios: `Interés bruto: €${interestGross.toFixed(2)} · Retención 19%: €${withholding.toFixed(2)} · Neto: €${interestNet.toFixed(2)}`,
    },
  });

  // Update account balance with net interest
  await prisma.account.update({
    where: { id: account_id },
    data: {
      balance: { increment: interestNet },
      last_interest_date: now,
    },
  });

  // Update bank balance
  const agg = await prisma.account.aggregate({ where: { bank_id: account.bank_id }, _sum: { balance: true } });
  await prisma.bank.update({ where: { id: account.bank_id }, data: { balance: agg._sum.balance ?? 0 } });

  return NextResponse.json({
    success: true,
    interest_gross: Math.round(interestGross * 100) / 100,
    withholding: Math.round(withholding * 100) / 100,
    interest_net: Math.round(interestNet * 100) / 100,
    transaction: tx,
  });
}
