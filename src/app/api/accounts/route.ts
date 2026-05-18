import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const bank_id = searchParams.get("bank_id");

  const where = bank_id ? { bank_id } : {};
  const accounts = await prisma.account.findMany({
    where,
    orderBy: [{ is_default: "desc" }, { account_label: "asc" }],
    include: { bank: { select: { bank_name: true } } },
  });

  return NextResponse.json(accounts);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { bank_id, account_label, iban, balance, is_default, interest_rate, interest_period } = body;

  if (!bank_id || !account_label) {
    return NextResponse.json({ error: "bank_id y account_label son requeridos" }, { status: 400 });
  }

  const bank = await prisma.bank.findUnique({ where: { id: bank_id }, include: { accounts: true } });
  if (!bank) {
    return NextResponse.json({ error: "Banco no encontrado" }, { status: 404 });
  }

  // If this is the first account or explicitly set as default, update others
  const makeDefault = is_default || bank.accounts.length === 0;
  if (makeDefault) {
    await prisma.account.updateMany({
      where: { bank_id },
      data: { is_default: false },
    });
  }

  const account = await prisma.account.create({
    data: {
      bank_id,
      account_label,
      iban: iban || null,
      balance: balance ?? 0,
      is_default: makeDefault,
      interest_rate: interest_rate ?? 0,
      interest_period: interest_period || "none",
    },
  });

  // Update bank balance as sum of account balances
  const agg = await prisma.account.aggregate({ where: { bank_id }, _sum: { balance: true } });
  await prisma.bank.update({ where: { id: bank_id }, data: { balance: agg._sum.balance ?? 0 } });

  return NextResponse.json(account, { status: 201 });
}
