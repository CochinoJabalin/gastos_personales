import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateIBAN } from "@/lib/iban";
import { verifyAuth } from "@/lib/api-auth";

async function ensureAccountsExist(banks: Awaited<ReturnType<typeof prisma.bank.findMany>>) {
  for (const bank of banks) {
    const count = await prisma.account.count({ where: { bank_id: bank.id } });
    if (count === 0) {
      await prisma.account.create({
        data: {
          bank_id: bank.id,
          account_label: bank.account_label || "Cuenta Principal",
          iban: bank.iban || null,
          balance: Number(bank.balance),
          is_default: true,
          interest_rate: 0,
          interest_period: "none",
        },
      });
    }
  }
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });

  const banks = await prisma.bank.findMany({
    orderBy: { bank_name: "asc" },
    include: {
      accounts: {
        orderBy: [{ is_default: "desc" }, { account_label: "asc" }],
      },
    },
  });

  // Auto-migrate banks that don't have accounts yet
  await ensureAccountsExist(banks);

  // Re-fetch to include newly created accounts
  const updatedBanks = await prisma.bank.findMany({
    orderBy: { bank_name: "asc" },
    include: {
      accounts: {
        orderBy: [{ is_default: "desc" }, { account_label: "asc" }],
      },
    },
  });

  const result = updatedBanks.map((bank) => {
    const accounts = bank.accounts.map((a) => ({
      id: a.id,
      account_label: a.account_label,
      iban: a.iban,
      balance: Number(a.balance),
      is_default: a.is_default,
      interest_rate: Number(a.interest_rate),
      interest_period: a.interest_period,
      last_interest_date: a.last_interest_date,
      created_at: a.created_at,
    }));
    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

    return {
      id: bank.id,
      bank_name: bank.bank_name,
      account_label: bank.account_label,
      iban: bank.iban,
      balance: Number(bank.balance),
      created_at: bank.created_at,
      accounts,
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();

  if (body.iban) {
    const validation = validateIBAN(body.iban);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    body.iban = validation.normalized;
  }

  const bank = await prisma.bank.create({
    data: {
      bank_name: body.bank_name,
      account_label: body.account_label,
      iban: body.iban ?? null,
      balance: body.balance ?? 0,
    },
  });

  // Automatically create a default account
  await prisma.account.create({
    data: {
      bank_id: bank.id,
      account_label: body.account_label || "Cuenta Principal",
      iban: body.iban || null,
      balance: body.balance ?? 0,
      is_default: true,
      interest_rate: 0,
      interest_period: "none",
    },
  });

  return NextResponse.json(bank, { status: 201 });
}
