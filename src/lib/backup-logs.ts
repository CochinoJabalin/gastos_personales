import { prisma } from "@/lib/prisma";

export interface CreateLogInput {
  scheduleId?: string | null;
  filename: string;
  filepath: string;
  size: number;
  stats: string;
}

export async function logBackup(input: CreateLogInput): Promise<void> {
  await prisma.backupLog.create({
    data: {
      scheduleId: input.scheduleId ?? null,
      filename: input.filename,
      filepath: input.filepath,
      size: input.size,
      stats: input.stats,
    },
  });
}

export async function getBackupLogs(limit = 50): Promise<unknown[]> {
  return prisma.backupLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { schedule: { select: { name: true } } },
  });
}

export async function getBackupLogById(id: string): Promise<unknown | null> {
  return prisma.backupLog.findUnique({
    where: { id },
  });
}

export async function deleteOldBackups(maxAgeDays: number): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);

  const old = await prisma.backupLog.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true, filepath: true },
  });

  if (old.length === 0) return 0;

  const { unlinkSync } = await import("fs");
  for (const log of old) {
    try {
      unlinkSync(log.filepath);
    } catch {
    }
  }

  const { count } = await prisma.backupLog.deleteMany({
    where: { id: { in: old.map((o) => o.id) } },
  });

  return count;
}
