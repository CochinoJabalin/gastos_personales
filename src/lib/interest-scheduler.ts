import { prisma } from "@/lib/prisma";

/**
 * InterestScheduler: Ensures that for every account with interest configured,
 * a scheduled transfer exists in the system. The actual execution is handled
 * by the TransferScheduler (which calls executeTransfer).
 * 
 * Interest transfers use from_account === to_account to signal interest payment.
 */
class InterestScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private initialized = false;
  private processing = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    // Check every 5 minutes for new accounts that need interest transfers
    this.intervalId = setInterval(() => this.ensureTransfersExist(), 5 * 60_000);
    // Also process immediately on init
    setTimeout(() => this.ensureTransfersExist().catch(console.error), 10_000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.initialized = false;
  }

  async ensureTransfersExist(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      // Find all accounts with interest configured
      const accounts = await prisma.account.findMany({
        where: {
          interest_rate: { gt: 0 },
          interest_period: { not: "none" },
        },
        include: { bank: true },
      });

      for (const account of accounts) {
        try {
          await this.ensureTransferForAccount(account);
        } catch (err) {
          console.error(`[InterestScheduler] Error for account ${account.id}:`, err);
        }
      }

      // Disable scheduled interest transfers for accounts that no longer have interest
      await this.cleanupOrphanedTransfers(accounts.map(a => a.id));
    } catch (err) {
      console.error("[InterestScheduler] Error:", err);
    } finally {
      this.processing = false;
    }
  }

  private async ensureTransferForAccount(account: {
    id: string;
    bank_id: string;
    account_label: string;
    balance: number | { toNumber?: () => number };
    interest_rate: number | { toNumber?: () => number };
    interest_period: string;
    last_interest_date: Date | null;
    created_at: Date;
    bank: { id: string; bank_name: string };
  }): Promise<void> {
    const rate = Number(account.interest_rate);
    const period = account.interest_period;
    const frequency = period === "daily" ? "diario" : "mensual";

    // Check if a scheduled interest transfer already exists for this account
    const existing = await prisma.transfer.findFirst({
      where: {
        from_account_id: account.id,
        to_account_id: account.id,
        is_scheduled: true,
        enabled: true,
        status: "pending",
      },
    });

    if (existing) {
      // Update the concept and expected amount if rate or balance changed
      const expectedConcept = this.buildConcept(account.account_label, rate, period);
      const balance = Number(account.balance);
      const rateDecimal = rate / 100;
      const WITHHOLDING = 0.19;
      let expectedGross = 0;
      if (period === "daily") {
        expectedGross = balance * rateDecimal / 360;
      } else {
        expectedGross = balance * rateDecimal / 12;
      }
      const expectedNet = Math.round(expectedGross * (1 - WITHHOLDING) * 100) / 100;

      if (existing.concept !== expectedConcept || Number(existing.amount) !== expectedNet) {
        await prisma.transfer.update({
          where: { id: existing.id },
          data: { concept: expectedConcept, amount: expectedNet },
        });
      }
      return;
    }

    // Calculate first next_run
    const lastDate = account.last_interest_date || account.created_at;
    let nextRun: Date;
    if (period === "daily") {
      nextRun = new Date(lastDate);
      nextRun.setDate(nextRun.getDate() + 1);
    } else {
      nextRun = new Date(lastDate);
      nextRun.setMonth(nextRun.getMonth() + 1);
    }

    // If next_run is in the past, set it to now (will execute immediately)
    const now = new Date();
    if (nextRun < now) {
      nextRun = now;
    }

    const concept = this.buildConcept(account.account_label, rate, period);

    // Calculate expected net amount based on current balance
    const balance = Number(account.balance);
    const rateDecimal = rate / 100;
    const WITHHOLDING = 0.19;
    let expectedGross = 0;
    if (period === "daily") {
      expectedGross = balance * rateDecimal / 360;
    } else {
      expectedGross = balance * rateDecimal / 12;
    }
    const expectedNet = Math.round(expectedGross * (1 - WITHHOLDING) * 100) / 100;

    await prisma.transfer.create({
      data: {
        from_account_id: account.id,
        to_account_id: account.id,
        amount: expectedNet,
        concept,
        timestamp: now,
        status: "pending",
        is_scheduled: true,
        frequency,
        next_run: nextRun,
        end_date: null,
        enabled: true,
      },
    });

    console.log(`[InterestScheduler] Created scheduled interest transfer for ${account.account_label} (${rate}% ${frequency})`);
  }

  private buildConcept(accountLabel: string, rate: number, period: string): string {
    const rateStr = rate.toLocaleString("es", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return `Intereses ${period === "daily" ? "diarios" : "mensuales"} ${rateStr}% (${accountLabel}) — Neto tras 19% IRPF`;
  }

  private async cleanupOrphanedTransfers(activeAccountIds: string[]): Promise<void> {
    // Find interest transfers (from===to, scheduled) for accounts no longer with interest
    const orphaned = await prisma.transfer.findMany({
      where: {
        is_scheduled: true,
        enabled: true,
        status: "pending",
        from_account_id: { notIn: activeAccountIds.length > 0 ? activeAccountIds : ["__none__"] },
      },
    });

    // Filter only interest transfers (from === to)
    for (const t of orphaned) {
      if (t.from_account_id === t.to_account_id) {
        await prisma.transfer.update({
          where: { id: t.id },
          data: { enabled: false, status: "cancelled" },
        });
        console.log(`[InterestScheduler] Disabled orphaned interest transfer ${t.id}`);
      }
    }
  }
}

export const interestScheduler = new InterestScheduler();
