import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const banks = await prisma.bank.findMany({ include: { accounts: true } });
  let created = 0;
  let skipped = 0;

  for (const bank of banks) {
    if (bank.accounts.length > 0) {
      skipped++;
      continue;
    }

    await prisma.account.create({
      data: {
        bank_id: bank.id,
        account_label: bank.account_label || "Cuenta Principal",
        iban: bank.iban || null,
        balance: bank.balance,
        is_default: true,
        interest_rate: 0,
        interest_period: "none",
      },
    });

    created++;
  }

  return NextResponse.json({ success: true, created, skipped });
}
