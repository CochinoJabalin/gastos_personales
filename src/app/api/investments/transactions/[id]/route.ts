import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;

    const tx = await prisma.investmentTransaction.findUnique({
      where: { id },
      include: { instrument: true },
    });

    if (!tx) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const linkedBankTx = await prisma.transaction.findFirst({
      where: { investment_transaction_id: tx.id },
    });

    if (linkedBankTx) {
      const bankAmount = linkedBankTx.amount;
      await prisma.account.update({
        where: { id: linkedBankTx.account_id! },
        data: { balance: { decrement: Number(bankAmount) } },
      });
      await prisma.bank.update({
        where: { id: linkedBankTx.bank_id },
        data: { balance: { decrement: Number(bankAmount) } },
      });
      await prisma.transaction.delete({ where: { id: linkedBankTx.id } });
    }

    if (tx.type === "BUY") {
      const cantidad = Number(tx.cantidad);
      const lot = await prisma.investmentLot.findFirst({
        where: {
          instrument_id: tx.instrument_id,
          cantidad_original: tx.cantidad,
          precio_unitario: tx.precio_unitario,
        },
        orderBy: { created_at: "desc" },
      });

      if (lot) {
        await prisma.investmentLot.delete({ where: { id: lot.id } });
      }

      if (tx.holding_id) {
        const holding = await prisma.investmentHolding.findUnique({ where: { id: tx.holding_id } });
        if (holding) {
          const newTotal = Number(holding.total_cantidad) - cantidad;
          if (newTotal <= 0) {
            await prisma.investmentTransaction.deleteMany({ where: { holding_id: tx.holding_id } });
            await prisma.investmentLot.deleteMany({ where: { holding_id: tx.holding_id } });
            await prisma.investmentHolding.delete({ where: { id: tx.holding_id } });
          } else {
            await prisma.investmentHolding.update({
              where: { id: tx.holding_id },
              data: {
                total_cantidad: { decrement: cantidad },
                total_invertido_original: { decrement: Number(tx.importe_total) },
                total_invertido_eur: { decrement: Number(tx.importe_eur) },
                updated_at: new Date(),
              },
            });
          }
        }
      }
    }

    await prisma.investmentTransaction.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting investment transaction:", error);
    return NextResponse.json({ error: "Error al eliminar la operación" }, { status: 500 });
  }
}
