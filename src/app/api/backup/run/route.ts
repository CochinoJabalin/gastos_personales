import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createBackup } from "@/lib/backup";
import { logBackup } from "@/lib/backup-logs";
import { prisma } from "@/lib/prisma";
import { readFileSync } from "fs";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const includeTransactions = body.includeTransactions !== false;
  const includeMappingRules = body.includeMappingRules !== false;
  const includeBanks = body.includeBanks !== false;

  const config = await prisma.appConfig.findUnique({ where: { id: "default" } });
  const targetDir = config?.backupPath ?? "/backups";

  const result = await createBackup({
    includeTransactions,
    includeMappingRules,
    includeBanks,
    targetDir,
  });

  await logBackup({
    scheduleId: null,
    filename: result.filename,
    filepath: result.filepath,
    size: result.size,
    stats: JSON.stringify(result.stats),
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
