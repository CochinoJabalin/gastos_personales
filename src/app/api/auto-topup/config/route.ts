import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { autoTopupManager } from "@/lib/auto-topup";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let config = await prisma.autoTopupConfig.findFirst();
  if (!config) {
    config = await prisma.autoTopupConfig.create({ data: {} });
  }

  return NextResponse.json({
    sourceBankName: config.sourceBankName,
    targetBankName: config.targetBankName,
    threshold: Number(config.threshold),
    amount: Number(config.amount),
    checkIntervalHours: config.checkIntervalHours,
    enabled: config.enabled,
    lastCheck: config.lastCheck,
    nextRun: autoTopupManager.nextRun,
  });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { sourceBankName, targetBankName, threshold, amount, checkIntervalHours, enabled } = body;

  const existing = await prisma.autoTopupConfig.findFirst();
  if (!existing) {
    await prisma.autoTopupConfig.create({ data: {} });
  }

  const data: Record<string, unknown> = {};
  if (sourceBankName !== undefined) data.sourceBankName = sourceBankName;
  if (targetBankName !== undefined) data.targetBankName = targetBankName;
  if (threshold !== undefined) data.threshold = threshold;
  if (amount !== undefined) data.amount = amount;
  if (checkIntervalHours !== undefined) data.checkIntervalHours = checkIntervalHours;
  if (enabled !== undefined) data.enabled = enabled;

  const config = await prisma.autoTopupConfig.update({
    where: { id: "default" },
    data,
  });

  // Reiniciar el manager para aplicar el nuevo intervalo
  if (checkIntervalHours !== undefined) {
    autoTopupManager.restart();
  }

  return NextResponse.json({
    sourceBankName: config.sourceBankName,
    targetBankName: config.targetBankName,
    threshold: Number(config.threshold),
    amount: Number(config.amount),
    checkIntervalHours: config.checkIntervalHours,
    enabled: config.enabled,
    lastCheck: config.lastCheck,
    nextRun: autoTopupManager.nextRun,
  });
}
