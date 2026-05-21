import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseSpanishNumber, applySign } from "@/lib/format";

async function resolveAccount(bankId: string, preferredAccountId?: string | null) {
  if (preferredAccountId) return preferredAccountId;
  const defaultAccount = await prisma.account.findFirst({
    where: { bank_id: bankId, is_default: true },
  });
  return defaultAccount?.id || null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const oldTx = await prisma.transaction.findUnique({ where: { id } });
  if (!oldTx) {
    return NextResponse.json({ error: "Transacción no encontrada" }, { status: 404 });
  }

  let amount = typeof body.amount === "number" ? body.amount : parseSpanishNumber(body.amount);
  amount = applySign(amount, body.group);

  const newAccountId = await resolveAccount(body.bank_id, body.account_id);

  try {
    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        concept: body.concept,
        amount,
        group: body.group,
        type: body.type,
        bank_id: body.bank_id,
        account_id: newAccountId,
        comentarios: body.comentarios || null,
        timestamp: body.timestamp ? new Date(body.timestamp) : undefined,
      },
      include: { bank: true, account: true },
    });

    // Reverse old transaction effect on old account and bank
    if (oldTx.account_id) {
      await prisma.account.update({
        where: { id: oldTx.account_id },
        data: { balance: { decrement: oldTx.amount } },
      });
    }
    await prisma.bank.update({
      where: { id: oldTx.bank_id },
      data: { balance: { decrement: oldTx.amount } },
    });

    // Apply new transaction effect on new account and bank
    if (newAccountId) {
      await prisma.account.update({
        where: { id: newAccountId },
        data: { balance: { increment: amount } },
      });
    }
    await prisma.bank.update({
      where: { id: body.bank_id },
      data: { balance: { increment: amount } },
    });

    return NextResponse.json(transaction);
  } catch {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx) {
    return NextResponse.json({ error: "Transacción no encontrada" }, { status: 404 });
  }

  try {
    await prisma.transaction.delete({
      where: { id },
    });

    // Reverse effect on account
    if (tx.account_id) {
      await prisma.account.update({
        where: { id: tx.account_id },
        data: { balance: { decrement: tx.amount } },
      });
    }

    // Reverse effect on bank
    await prisma.bank.update({
      where: { id: tx.bank_id },
      data: { balance: { decrement: tx.amount } },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Error al eliminar" },
      { status: 500 }
    );
  }
}
