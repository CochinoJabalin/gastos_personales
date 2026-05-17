import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { oldText, newText } = await request.json();
  if (!oldText || !newText) {
    return NextResponse.json({ error: "oldText y newText son requeridos" }, { status: 400 });
  }

  const transactions = await prisma.transaction.findMany({
    where: { concept: { contains: oldText } },
  });

  const updated = await prisma.$transaction(
    transactions.map((t) =>
      prisma.transaction.update({
        where: { id: t.id },
        data: { concept: t.concept.replace(oldText, newText) },
      })
    )
  );

  return NextResponse.json({ updated: updated.length });
}
