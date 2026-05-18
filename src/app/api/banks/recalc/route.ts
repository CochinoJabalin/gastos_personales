import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const banks = await prisma.bank.findMany();

  for (const bank of banks) {
    const agg = await prisma.transaction.aggregate({
      where: { bank_id: bank.id },
      _sum: { amount: true },
    });
    await prisma.bank.update({
      where: { id: bank.id },
      data: { balance: agg._sum.amount ?? 0 },
    });
  }

  return NextResponse.json({ success: true, recalculated: banks.length });
}
