import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();

  // Batch update by IDs
  if (body.ids) {
    const { ids, data } = body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids debe ser un array no vacío" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (data.timestamp) updateData.timestamp = new Date(data.timestamp);
    if (data.bank_id) updateData.bank_id = data.bank_id;
    if (data.group) updateData.group = data.group;
    if (data.type) updateData.type = data.type;
    if (data.concept) updateData.concept = data.concept;

    const result = await prisma.transaction.updateMany({
      where: { id: { in: ids } },
      data: updateData,
    });

    return NextResponse.json({ updated: result.count });
  }

  // Existing: concept find-and-replace
  const { oldText, newText } = body;
  if (!oldText || !newText) {
    return NextResponse.json({ error: "oldText y newText son requeridos" }, { status: 400 });
  }

  const transactions = await prisma.transaction.findMany({
    where: { concept: { contains: oldText, mode: "insensitive" } },
  });

  const updated = await prisma.$transaction(
    transactions.map((t) =>
      prisma.transaction.update({
        where: { id: t.id },
        data: { concept: t.concept.replaceAll(oldText, newText) },
      })
    )
  );

  return NextResponse.json({ updated: updated.length });
}
