import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; pid: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const payment = await prisma.crowdlendingPayment.findUnique({
    where: { id: params.pid },
  });

  if (!payment) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  }

  // Reverse linked transaction
  if (payment.created_transaction_id) {
    const tx = await prisma.transaction.findUnique({
      where: { id: payment.created_transaction_id },
    });
    if (tx) {
      await prisma.transaction.delete({
        where: { id: payment.created_transaction_id },
      });

      if (tx.account_id) {
        await prisma.account.update({
          where: { id: tx.account_id },
          data: { balance: { decrement: tx.amount } },
        });
      }

      await prisma.bank.update({
        where: { id: tx.bank_id },
        data: { balance: { decrement: tx.amount } },
      });
    }
  }

  await prisma.crowdlendingPayment.delete({
    where: { id: params.pid },
  });

  return NextResponse.json({ success: true });
}
