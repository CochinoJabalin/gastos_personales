import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let config = await prisma.appConfig.findFirst();
  if (!config) {
    config = await prisma.appConfig.create({ data: {} });
  }

  let allocations: Record<string, number> = {};
  try {
    allocations = JSON.parse(config.investmentTargetAllocation || "{}");
  } catch {
    allocations = {};
  }

  return NextResponse.json({ allocations });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { allocations } = body;

  if (!allocations || typeof allocations !== "object") {
    return NextResponse.json({ error: "allocations debe ser un objeto" }, { status: 400 });
  }

  // Validar que los valores sumen 100 (o cercano)
  const total = Object.values(allocations as Record<string, number>).reduce((sum, val) => sum + val, 0);
  if (total > 0 && Math.abs(total - 100) > 1) {
    return NextResponse.json({ error: "Los porcentajes deben sumar 100%" }, { status: 400 });
  }

  const existing = await prisma.appConfig.findFirst();
  if (!existing) {
    await prisma.appConfig.create({ data: {} });
  }

  const config = await prisma.appConfig.update({
    where: { id: "default" },
    data: { investmentTargetAllocation: JSON.stringify(allocations) },
  });

  return NextResponse.json({ 
    allocations: JSON.parse(config.investmentTargetAllocation || "{}") 
  });
}
