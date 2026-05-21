import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBackupLogById } from "@/lib/backup-logs";
import { restoreFromBackup } from "@/lib/restore";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { logId } = await request.json();
  if (!logId) {
    return NextResponse.json({ error: "logId es requerido" }, { status: 400 });
  }

  const log = await getBackupLogById(logId);
  if (!log) {
    return NextResponse.json({ error: "Backup no encontrado" }, { status: 404 });
  }

  const logRecord = log as { filepath: string };

  try {
    const summary = await restoreFromBackup(logRecord.filepath);
    return NextResponse.json({ success: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
