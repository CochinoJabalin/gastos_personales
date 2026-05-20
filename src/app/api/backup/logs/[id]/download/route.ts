import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBackupLogById } from "@/lib/backup-logs";
import { readFileSync, existsSync } from "fs";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const log = await getBackupLogById(params.id);

  if (!log) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const logRecord = log as { filename: string; filepath: string; size: number };

  if (!existsSync(logRecord.filepath)) {
    return NextResponse.json({ error: "Archivo no encontrado en disco" }, { status: 404 });
  }

  const fileBuffer = readFileSync(logRecord.filepath);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${logRecord.filename}"`,
      "Content-Length": String(fileBuffer.length),
    },
  });
}
