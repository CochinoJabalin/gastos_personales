import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseSpanishNumber, applySign } from "@/lib/format";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  
  let amount = typeof body.amount === "number" ? body.amount : parseSpanishNumber(body.amount);
  amount = applySign(amount, body.group);

  try {
    const transaction = await prisma.transaction.update({
      where: { id: params.id },
      data: {
        concept: body.concept,
        amount,
        group: body.group,
        type: body.type,
        bank_id: body.bank_id,
        comentarios: body.comentarios || null,
      },
      include: { bank: true },
    });
    return NextResponse.json(transaction);
  } catch {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    await prisma.transaction.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Transacción no encontrada" },
      { status: 404 }
    );
  }
}
