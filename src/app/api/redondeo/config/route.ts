import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let config = await prisma.redondeoConfig.findFirst();
  if (!config) {
    config = await prisma.redondeoConfig.create({
      data: {
        enabled: false,
        target_account_id: "",
        multiplier: 5,
      },
    });
  }

  const accounts = await prisma.account.findMany({
    where: { bank: { bank_name: "Revolut" } },
    orderBy: { account_label: "asc" },
  });

  return NextResponse.json({ config, accounts });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();

  if (body.target_account_id && typeof body.target_account_id !== "string") {
    return NextResponse.json({ error: "target_account_id debe ser un string" }, { status: 400 });
  }
  if (body.multiplier && (typeof body.multiplier !== "number" || body.multiplier < 1)) {
    return NextResponse.json({ error: "multiplier debe ser un número >= 1" }, { status: 400 });
  }

  const existing = await prisma.redondeoConfig.findFirst();
  if (existing) {
    await prisma.redondeoConfig.update({
      where: { id: existing.id },
      data: {
        enabled: body.enabled !== undefined ? body.enabled : existing.enabled,
        target_account_id: body.target_account_id !== undefined ? body.target_account_id : existing.target_account_id,
        multiplier: body.multiplier !== undefined ? body.multiplier : existing.multiplier,
      },
    });
  } else {
    await prisma.redondeoConfig.create({
      data: {
        enabled: body.enabled ?? false,
        target_account_id: body.target_account_id ?? "",
        multiplier: body.multiplier ?? 5,
      },
    });
  }

  const config = await prisma.redondeoConfig.findFirst();
  return NextResponse.json({ config });
}
