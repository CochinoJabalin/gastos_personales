import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.account_label !== undefined) data.account_label = body.account_label;
  if (body.iban !== undefined) data.iban = body.iban || null;
  if (body.balance !== undefined) data.balance = body.balance;
  if (body.interest_rate !== undefined) data.interest_rate = body.interest_rate;
  if (body.interest_period !== undefined) data.interest_period = body.interest_period;

  if (body.is_default) {
    await prisma.account.updateMany({
      where: { bank_id: account.bank_id },
      data: { is_default: false },
    });
    data.is_default = true;
  }

  const updated = await prisma.account.update({
    where: { id },
    data,
  });

  // Update bank balance
  const agg = await prisma.account.aggregate({ where: { bank_id: account.bank_id }, _sum: { balance: true } });
  await prisma.bank.update({ where: { id: account.bank_id }, data: { balance: agg._sum.balance ?? 0 } });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const account = await prisma.account.findUnique({
    where: { id },
    include: { bank: { include: { accounts: true } } },
  });
  if (!account) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });

  if (account.is_default && account.bank.accounts.length > 1) {
    return NextResponse.json({ error: "No puedes eliminar la cuenta por defecto. Establece otra como default primero." }, { status: 400 });
  }

  const txCount = await prisma.transaction.count({ where: { account_id: id } });
  if (txCount > 0) {
    await prisma.transaction.updateMany({
      where: { account_id: id },
      data: { account_id: null },
    });
  }

  await prisma.account.delete({ where: { id } });

  const agg = await prisma.account.aggregate({ where: { bank_id: account.bank_id }, _sum: { balance: true } });
  await prisma.bank.update({ where: { id: account.bank_id }, data: { balance: agg._sum.balance ?? 0 } });

  return NextResponse.json({ success: true });
}
