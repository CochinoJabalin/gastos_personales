import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { executeTransfer } from "@/lib/transfer-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const transfer = await prisma.transfer.findUnique({ where: { id: params.id } });
  if (!transfer) {
    return NextResponse.json({ error: "Transferencia no encontrada" }, { status: 404 });
  }

  if (transfer.status !== "pending") {
    return NextResponse.json({ error: "La transferencia no está pendiente" }, { status: 400 });
  }

  if (!transfer.enabled) {
    return NextResponse.json({ error: "La transferencia está deshabilitada" }, { status: 400 });
  }

  try {
    await executeTransfer(params.id);

    const updated = await prisma.transfer.findUnique({
      where: { id: params.id },
      include: {
        from_account: { include: { bank: { select: { bank_name: true } } } },
        to_account: { include: { bank: { select: { bank_name: true } } } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[Transfer Execute] Error:", err);
    return NextResponse.json({ error: "Error al ejecutar la transferencia" }, { status: 500 });
  }
}
