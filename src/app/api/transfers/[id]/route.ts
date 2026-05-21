import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { transferScheduler } from "@/lib/transfer-scheduler";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const transfer = await prisma.transfer.findUnique({ where: { id: params.id } });
  if (!transfer) {
    return NextResponse.json({ error: "Transferencia no encontrada" }, { status: 404 });
  }

  if (transfer.status === "completed" && !transfer.is_scheduled) {
    return NextResponse.json({ error: "No se puede editar una transferencia ya completada" }, { status: 400 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (body.amount !== undefined) {
    const amt = typeof body.amount === "number" ? body.amount : parseFloat(body.amount);
    if (amt <= 0) return NextResponse.json({ error: "El importe debe ser positivo" }, { status: 400 });
    data.amount = amt;
  }
  if (body.concept !== undefined) data.concept = body.concept;
  if (body.frequency !== undefined) data.frequency = body.frequency;
  if (body.end_date !== undefined) data.end_date = body.end_date ? new Date(body.end_date) : null;
  if (body.enabled !== undefined) data.enabled = body.enabled;
  if (body.from_account_id !== undefined) data.from_account_id = body.from_account_id;
  if (body.to_account_id !== undefined) data.to_account_id = body.to_account_id;

  if (body.from_account_id && body.to_account_id && body.from_account_id === body.to_account_id) {
    return NextResponse.json({ error: "La cuenta origen y destino deben ser diferentes" }, { status: 400 });
  }

  if (body.timestamp !== undefined) {
    data.timestamp = new Date(body.timestamp);
  }

  const updated = await prisma.transfer.update({
    where: { id: params.id },
    data,
    include: {
      from_account: { include: { bank: { select: { bank_name: true } } } },
      to_account: { include: { bank: { select: { bank_name: true } } } },
    },
  });

  // Re-register in scheduler if scheduled
  if (updated.is_scheduled) {
    transferScheduler.register(updated.id);
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const transfer = await prisma.transfer.findUnique({ where: { id: params.id } });
  if (!transfer) {
    return NextResponse.json({ error: "Transferencia no encontrada" }, { status: 404 });
  }

  // If completed, we would need to reverse the transactions
  // For now, only allow deleting pending/cancelled transfers
  if (transfer.status === "completed") {
    // Soft delete - mark as cancelled
    await prisma.transfer.update({
      where: { id: params.id },
      data: { status: "cancelled", enabled: false },
    });
  } else {
    transferScheduler.unregister(params.id);
    await prisma.transfer.delete({ where: { id: params.id } });
  }

  return NextResponse.json({ success: true });
}
