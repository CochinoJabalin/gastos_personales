import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const instrument = await prisma.investmentInstrument.findUnique({
    where: { id },
    include: {
      holdings: { include: { account: true } },
    },
  });

  if (!instrument) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json(instrument);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const instrument = await prisma.investmentInstrument.update({
    where: { id },
    data: {
      ticker: body.ticker,
      name: body.name,
      type: body.type,
      currency: body.currency,
      current_price: body.current_price ?? undefined,
      exchange_rate_to_eur: body.exchange_rate_to_eur ?? undefined,
      sector: body.sector,
    },
  });

  return NextResponse.json(instrument);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  await prisma.investmentLot.deleteMany({ where: { instrument_id: id } });
  await prisma.investmentTransaction.deleteMany({ where: { instrument_id: id } });
  await prisma.investmentHolding.deleteMany({ where: { instrument_id: id } });
  await prisma.investmentInstrument.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
