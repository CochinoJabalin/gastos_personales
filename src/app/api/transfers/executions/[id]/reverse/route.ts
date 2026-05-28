import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const execution = await prisma.transferExecution.findUnique({
    where: { id: params.id },
    include: {
      transfer: {
        include: {
          from_account: { include: { bank: true } },
          to_account: { include: { bank: true } },
        },
      },
    },
  });

  if (!execution) {
    return NextResponse.json(
      { error: "Ejecución no encontrada" },
      { status: 404 }
    );
  }

  if (execution.status !== "completed") {
    return NextResponse.json(
      { error: "Solo se puede revertir una ejecución completada" },
      { status: 400 }
    );
  }

  const amount = Number(execution.amount);
  const fromAccount = execution.transfer.from_account;
  const toAccount = execution.transfer.to_account;

  const fromBalanceBefore = Number(fromAccount.balance);
  const toBalanceBefore = Number(toAccount.balance);

  await prisma.transferExecution.update({
    where: { id: execution.id },
    data: { status: "reversed" },
  });

  // Reverse: source gets money back, destination loses it
  await prisma.account.update({
    where: { id: fromAccount.id },
    data: { balance: { increment: amount } },
  });

  await prisma.account.update({
    where: { id: toAccount.id },
    data: { balance: { decrement: amount } },
  });

  // Update bank balances if different banks
  if (fromAccount.bank_id !== toAccount.bank_id) {
    await prisma.bank.update({
      where: { id: fromAccount.bank_id },
      data: { balance: { increment: amount } },
    });
    await prisma.bank.update({
      where: { id: toAccount.bank_id },
      data: { balance: { decrement: amount } },
    });
  }

  return NextResponse.json({
    success: true,
    message: `Revertida transferencia de ${amount.toFixed(2)}€`,
    from_account: {
      id: fromAccount.id,
      bank_name: fromAccount.bank.bank_name,
      account_label: fromAccount.account_label,
      balance_before: fromBalanceBefore,
      balance_after: fromBalanceBefore + amount,
    },
    to_account: {
      id: toAccount.id,
      bank_name: toAccount.bank.bank_name,
      account_label: toAccount.account_label,
      balance_before: toBalanceBefore,
      balance_after: toBalanceBefore - amount,
    },
  });
}
