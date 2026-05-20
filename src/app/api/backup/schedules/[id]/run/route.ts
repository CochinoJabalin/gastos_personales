import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createBackup } from "@/lib/backup";
import { logBackup } from "@/lib/backup-logs";
import { readFileSync } from "fs";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const schedule = await prisma.backupSchedule.findUnique({
    where: { id: params.id },
  });

  if (!schedule) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const config = await prisma.appConfig.findUnique({ where: { id: "default" } });
  const targetDir = schedule.path || config?.backupPath || "/backups";

  const result = await createBackup({
    includeTransactions: schedule.includeTransactions,
    includeMappingRules: schedule.includeMappingRules,
    includeBanks: schedule.includeBanks,
    targetDir,
  });

  await logBackup({
    scheduleId: schedule.id,
    filename: result.filename,
    filepath: result.filepath,
    size: result.size,
    stats: JSON.stringify(result.stats),
  });

  await prisma.backupSchedule.update({
    where: { id: schedule.id },
    data: { lastRun: new Date() },
  });

  const fileBuffer = readFileSync(result.filepath);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Content-Length": String(fileBuffer.length),
    },
  });
}
