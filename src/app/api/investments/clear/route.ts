import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const type = body.type; // "all" | "dividends"

    if (type === "dividends") {
      const count = await prisma.investmentTransaction.count({ where: { type: "DIVIDEND" } });
      await prisma.investmentTransaction.deleteMany({ where: { type: "DIVIDEND" } });
      return NextResponse.json({ deleted: count, type: "dividends" });
    }

    // Delete all investment data (order matters for FK constraints)
    const txCount = await prisma.investmentTransaction.count();
    await prisma.investmentTransaction.deleteMany();
    await prisma.investmentLot.deleteMany();
    await prisma.investmentHolding.deleteMany();
    await prisma.investmentInstrument.deleteMany();

    return NextResponse.json({ deleted: txCount, type: "all" });
  } catch (err) {
    console.error("[Investments Clear]", err);
    return NextResponse.json({ error: "Error al vaciar datos" }, { status: 500 });
  }
}
