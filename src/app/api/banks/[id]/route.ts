import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateIBAN } from "@/lib/iban";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();

  const data: Record<string, unknown> = {};

  if (body.bank_name !== undefined) data.bank_name = body.bank_name;
  if (body.account_label !== undefined) data.account_label = body.account_label;
  if (body.iban !== undefined) {
    if (body.iban) {
      const validation = validateIBAN(body.iban);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      data.iban = validation.normalized;
    } else {
      data.iban = null;
    }
  }
  if (body.balance !== undefined) data.balance = body.balance;

  try {
    const bank = await prisma.bank.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json(bank);
  } catch {
    return NextResponse.json({ error: "Banco no encontrado" }, { status: 404 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const txCount = await prisma.transaction.count({
    where: { bank_id: params.id },
  });

  if (txCount > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: el banco tiene ${txCount} transacciones asociadas` },
      { status: 400 }
    );
  }

  try {
    await prisma.mappingRule.deleteMany({ where: { default_bank_id: params.id } });
    await prisma.bank.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Banco no encontrado" }, { status: 404 });
  }
}
