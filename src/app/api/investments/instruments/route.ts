import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const instruments = await prisma.investmentInstrument.findMany({
    orderBy: { ticker: "asc" },
    include: {
      _count: { select: { holdings: true, transactions: true } },
    },
  });

  return NextResponse.json(instruments);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();

  const instrument = await prisma.investmentInstrument.create({
    data: {
      ticker: body.ticker,
      name: body.name,
      type: body.type,
      currency: body.currency || "EUR",
      sector: body.sector || null,
    },
  });

  return NextResponse.json(instrument, { status: 201 });
}
