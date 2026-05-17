import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateIBAN } from "@/lib/iban";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const banks = await prisma.bank.findMany({
    orderBy: { bank_name: "asc" },
  });

  return NextResponse.json(banks);
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
    },
  });

  return NextResponse.json(bank, { status: 201 });
}
