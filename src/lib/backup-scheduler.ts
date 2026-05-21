import cron from "node-cron";
import { prisma } from "@/lib/prisma";
import { createBackup } from "@/lib/backup";
import { logBackup } from "@/lib/backup-logs";

class BackupScheduler {
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.loadAll().catch((err) =>
      console.error("[BackupScheduler] init error:", err)
    );
  }

  async loadAll(): Promise<void> {
    const schedules = await prisma.backupSchedule.findMany({
      where: { enabled: true },
    });

    for (const schedule of schedules) {
      this.register(schedule);
    }
  }

  register(schedule: {
    id: string;
    frequency: string;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    time: string;
    path: string | null;
  }): void {
    this.unregister(schedule.id);

    const expression = this.toCronExpression(schedule);
    if (!expression) return;

    const task = cron.schedule(expression, async () => {
      try {
        const result = await createBackup({
          targetDir: schedule.path ?? undefined,
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
      } catch (err) {
        console.error(`[BackupScheduler] Error running schedule ${schedule.id}:`, err);
      }
    });

    this.tasks.set(schedule.id, task);
  }

  unregister(id: string): void {
    const existing = this.tasks.get(id);
    if (existing) {
      existing.stop();
      this.tasks.delete(id);
    }
  }

  async reload(): Promise<void> {
    for (const [id] of this.tasks) {
      this.unregister(id);
    }
    await this.loadAll();
  }

  private toCronExpression(schedule: {
    frequency: string;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    time: string;
  }): string | null {
    const [hour, minute] = schedule.time.split(":").map(Number);
    if (isNaN(hour) || isNaN(minute)) return null;

    switch (schedule.frequency) {
      case "daily":
        return `${minute} ${hour} * * *`;
      case "weekly":
        if (schedule.dayOfWeek == null) return null;
        return `${minute} ${hour} * * ${schedule.dayOfWeek}`;
      case "monthly":
        if (schedule.dayOfMonth == null) return null;
        return `${minute} ${hour} ${schedule.dayOfMonth} * *`;
      default:
        return null;
    }
  }
}

export const backupScheduler = new BackupScheduler();
