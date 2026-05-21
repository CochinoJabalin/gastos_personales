import { prisma } from "@/lib/prisma";
import { executeTransfer } from "@/lib/transfer-utils";

class TransferScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private initialized = false;
  private processing = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    // Check every 60 seconds for pending transfers
    this.intervalId = setInterval(() => this.processPending(), 60_000);
    // Also process immediately on init
    this.processPending().catch((err) =>
      console.error("[TransferScheduler] init error:", err)
    );
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.initialized = false;
  }

  async processPending(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      const now = new Date();

      const pending = await prisma.transfer.findMany({
        where: {
          enabled: true,
          status: "pending",
          next_run: { lte: now },
        },
      });

      for (const transfer of pending) {
        try {
          await executeTransfer(transfer.id);
          console.log(`[TransferScheduler] Executed transfer ${transfer.id}`);
        } catch (err) {
          console.error(`[TransferScheduler] Error executing transfer ${transfer.id}:`, err);
        }
      }
    } catch (err) {
      console.error("[TransferScheduler] Error processing pending:", err);
    } finally {
      this.processing = false;
    }
  }

  async register(transferId: string): Promise<void> {
    // The scheduler will pick it up on next cycle
    // No need to do anything special - just ensure it's in the DB with next_run set
    console.log(`[TransferScheduler] Registered transfer ${transferId}`);
  }

  unregister(transferId: string): void {
    console.log(`[TransferScheduler] Unregistered transfer ${transferId}`);
  }

  async reload(): Promise<void> {
    console.log("[TransferScheduler] Reloading...");
  }
}

export const transferScheduler = new TransferScheduler();
