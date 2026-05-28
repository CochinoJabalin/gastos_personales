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

      // Find all transfers whose next_run has passed (catch-up support)
      let pending = await prisma.transfer.findMany({
        where: {
          enabled: true,
          status: "pending",
          next_run: { lte: now },
        },
      });

      // Process in a loop to handle catch-up (missed executions)
      while (pending.length > 0) {
        for (const transfer of pending) {
          try {
            await executeTransfer(transfer.id);
            console.log(`[TransferScheduler] Executed transfer ${transfer.id} (next_run was ${transfer.next_run?.toISOString()})`);
          } catch (err) {
            console.error(`[TransferScheduler] Error executing transfer ${transfer.id}:`, err);
          }
        }

        // Re-fetch: after execution, if next_run was advanced but is still in the past,
        // we need to execute again (catch-up for missed days/months)
        pending = await prisma.transfer.findMany({
          where: {
            enabled: true,
            status: "pending",
            next_run: { lte: now },
          },
        });
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
