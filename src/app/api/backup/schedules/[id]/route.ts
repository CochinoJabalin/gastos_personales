import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { backupScheduler } from "@/lib/backup-scheduler";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const schedule = await prisma.backupSchedule.findUnique({
    where: { id },
  });

  if (!schedule) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json(schedule);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const existing = await prisma.backupSchedule.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.frequency !== undefined) updateData.frequency = body.frequency;
  if (body.dayOfWeek !== undefined) updateData.dayOfWeek = body.dayOfWeek;
  if (body.dayOfMonth !== undefined) updateData.dayOfMonth = body.dayOfMonth;
  if (body.time !== undefined) updateData.time = body.time;
  if (body.enabled !== undefined) updateData.enabled = body.enabled;
  if (body.path !== undefined) updateData.path = body.path;
  if (body.includeTransactions !== undefined) updateData.includeTransactions = body.includeTransactions;
  if (body.includeMappingRules !== undefined) updateData.includeMappingRules = body.includeMappingRules;
  if (body.includeBanks !== undefined) updateData.includeBanks = body.includeBanks;

  if (body.time || body.frequency || body.dayOfWeek || body.dayOfMonth) {
    const frequency = body.frequency ?? existing.frequency;
    const dayOfWeek = body.dayOfWeek !== undefined ? body.dayOfWeek : existing.dayOfWeek;
    const dayOfMonth = body.dayOfMonth !== undefined ? body.dayOfMonth : existing.dayOfMonth;
    const time = body.time ?? existing.time;

    const now = new Date();
    const [hour, minute] = time.split(":").map(Number);
    const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);

    if (candidate <= now) candidate.setDate(candidate.getDate() + 1);

    switch (frequency) {
      case "weekly":
        if (dayOfWeek != null) {
          const diff = (dayOfWeek - candidate.getDay() + 7) % 7;
          candidate.setDate(candidate.getDate() + diff);
        }
        break;
      case "monthly":
        if (dayOfMonth != null) {
          candidate.setDate(dayOfMonth);
          if (candidate <= now) candidate.setMonth(candidate.getMonth() + 1);
        }
        break;
    }

    updateData.nextRun = candidate;
  }

  const schedule = await prisma.backupSchedule.update({
    where: { id },
    data: updateData,
  });

  if (schedule.enabled) {
    backupScheduler.register(schedule);
  } else {
    backupScheduler.unregister(schedule.id);
  }

  return NextResponse.json(schedule);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  backupScheduler.unregister(id);

  await prisma.backupSchedule.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
