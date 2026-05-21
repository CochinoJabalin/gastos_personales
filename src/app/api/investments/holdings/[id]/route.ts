import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const holding = await prisma.investmentHolding.findUnique({
    where: { id },
    include: {
      instrument: true,
      account: { select: { id: true, account_label: true, iban: true } },
      lots: { orderBy: { fecha_compra: "asc" } },
      transactions: {
        orderBy: { date: "desc" },
        take: 50,
      },
    },
  });

  if (!holding) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json(holding);
}
