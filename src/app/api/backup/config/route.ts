import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { backupScheduler } from "@/lib/backup-scheduler";

backupScheduler.init();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let config = await prisma.appConfig.findUnique({ where: { id: "default" } });
  if (!config) {
    config = await prisma.appConfig.create({ data: { id: "default" } });
  }

  return NextResponse.json(config);
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const config = await prisma.appConfig.upsert({
    where: { id: "default" },
    update: { backupPath: body.backupPath ?? "/backups" },
    create: { id: "default", backupPath: body.backupPath ?? "/backups" },
  });

  return NextResponse.json(config);
}
