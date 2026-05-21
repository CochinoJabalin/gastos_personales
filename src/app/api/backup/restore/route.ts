import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBackupLogById } from "@/lib/backup-logs";
import { restoreFromBackup, restoreFromBuffer } from "@/lib/restore";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const contentType = request.headers.get("content-type") || "";

  try {
    // Handle file upload via FormData
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "Archivo no proporcionado" }, { status: 400 });
      }

      if (!file.name.endsWith(".zip")) {
        return NextResponse.json({ error: "El archivo debe ser un .zip" }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const summary = await restoreFromBuffer(buffer);
      return NextResponse.json({ success: true, summary });
    }

    // Handle restore from existing backup log (JSON body)
    const { logId } = await request.json();
    if (!logId) {
      return NextResponse.json({ error: "logId es requerido" }, { status: 400 });
    }

    const log = await getBackupLogById(logId);
    if (!log) {
      return NextResponse.json({ error: "Backup no encontrado" }, { status: 404 });
    }

    const logRecord = log as { filepath: string };

    const summary = await restoreFromBackup(logRecord.filepath);
    return NextResponse.json({ success: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
