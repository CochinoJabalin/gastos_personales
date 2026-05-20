import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { backupScheduler } from "@/lib/backup-scheduler";

backupScheduler.init();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const schedules = await prisma.backupSchedule.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(schedules);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();

  if (!body.name || !body.frequency || !body.time) {
    return NextResponse.json({ error: "name, frequency, time son requeridos" }, { status: 400 });
  }

  const nextRun = calculateNextRun({
    frequency: body.frequency,
    dayOfWeek: body.dayOfWeek ?? null,
    dayOfMonth: body.dayOfMonth ?? null,
    time: body.time,
  });

  const schedule = await prisma.backupSchedule.create({
    data: {
      name: body.name,
      frequency: body.frequency,
      dayOfWeek: body.dayOfWeek ?? null,
      dayOfMonth: body.dayOfMonth ?? null,
      time: body.time,
      enabled: body.enabled !== false,
      path: body.path ?? null,
      includeTransactions: body.includeTransactions !== false,
      includeMappingRules: body.includeMappingRules !== false,
      includeBanks: body.includeBanks !== false,
      nextRun,
    },
  });

  if (schedule.enabled) {
    backupScheduler.register(schedule);
  }

  return NextResponse.json(schedule, { status: 201 });
}

function calculateNextRun(opts: {
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  time: string;
}): Date {
  const now = new Date();
  const [hour, minute] = opts.time.split(":").map(Number);
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);

  if (candidate <= now) {
    candidate.setDate(candidate.getDate() + 1);
  }

  switch (opts.frequency) {
    case "weekly": {
      if (opts.dayOfWeek == null) break;
      const diff = (opts.dayOfWeek - candidate.getDay() + 7) % 7;
      candidate.setDate(candidate.getDate() + diff);
      break;
    }
    case "monthly": {
      if (opts.dayOfMonth == null) break;
      candidate.setDate(opts.dayOfMonth);
      if (candidate <= now) {
        candidate.setMonth(candidate.getMonth() + 1);
      }
      break;
    }
  }

  return candidate;
}
