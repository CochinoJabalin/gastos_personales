import { prisma } from "@/lib/prisma";
import { executeTransfer } from "@/lib/transfer-utils";

const DEFAULT_INTERVAL_HOURS = 3;

class AutoTopupManager {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;
  private processing = false;
  private currentIntervalHours = DEFAULT_INTERVAL_HOURS;
  private _nextRun: Date | null = null;

  get nextRun(): Date | null {
    return this._nextRun;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await this.scheduleNextCheck();
    this.checkAndTopup().catch((err) =>
      console.error("[AutoTopup] init error:", err)
    );
  }

  private async scheduleNextCheck(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    try {
      const config = await prisma.autoTopupConfig.findFirst();
      this.currentIntervalHours = config?.checkIntervalHours ?? DEFAULT_INTERVAL_HOURS;
    } catch {
      this.currentIntervalHours = DEFAULT_INTERVAL_HOURS;
    }

    // Align to next exact hour boundary
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setMinutes(0, 0, 0);
    // Find the next exact hour that is a multiple of the interval from midnight
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const interval = this.currentIntervalHours;
    // Next aligned slot
    let nextSlotHour = Math.ceil((currentHour + (currentMinutes > 0 ? 1 : 0)) / interval) * interval;
    if (nextSlotHour <= currentHour && currentMinutes > 0) {
      nextSlotHour += interval;
    }
    // Handle day overflow
    const nextRunDate = new Date(now);
    nextRunDate.setHours(nextSlotHour % 24, 0, 0, 0);
    if (nextSlotHour >= 24) {
      nextRunDate.setDate(nextRunDate.getDate() + 1);
    }

    this._nextRun = nextRunDate;
    const delayMs = nextRunDate.getTime() - now.getTime();

    this.timeoutId = setTimeout(() => this.onTick(), delayMs);
    console.log(`[AutoTopup] Scheduled to check every ${this.currentIntervalHours}h — next run at ${nextRunDate.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`);
  }

  private async onTick(): Promise<void> {
    await this.checkAndTopup();
    // Schedule next tick at exact hour
    await this.scheduleNextCheck();
  }

  stop(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this._nextRun = null;
    this.initialized = false;
  }

  async restart(): Promise<void> {
    this.stop();
    this.initialized = false;
    await this.init();
  }

  async checkAndTopup(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      const config = await prisma.autoTopupConfig.findFirst();
      if (!config || !config.enabled) return;

      // Si el intervalo cambió, reprogramar
      if (config.checkIntervalHours !== this.currentIntervalHours) {
        await this.scheduleNextCheck();
      }

      const sourceAccount = await prisma.account.findFirst({
        where: {
          bank: { bank_name: config.sourceBankName },
          is_default: true,
        },
        include: { bank: true },
      });

      const targetAccount = await prisma.account.findFirst({
        where: {
          bank: { bank_name: config.targetBankName },
          is_default: true,
        },
        include: { bank: true },
      });

      if (!sourceAccount || !targetAccount) {
        console.error(`[AutoTopup] Source account "${config.sourceBankName}" or target account "${config.targetBankName}" not found`);
        return;
      }

      const targetBalance = Number(targetAccount.balance);
      const threshold = Number(config.threshold);

      await prisma.autoTopupConfig.update({
        where: { id: "default" },
        data: { lastCheck: new Date() },
      });

      if (targetBalance >= threshold) return;

      const topupAmount = Number(config.amount);

      const existingPending = await prisma.transfer.findFirst({
        where: {
          from_account_id: sourceAccount.id,
          to_account_id: targetAccount.id,
          amount: topupAmount,
          status: "pending",
          enabled: true,
        },
      });

      if (existingPending) return;

      const transfer = await prisma.transfer.create({
        data: {
          from_account_id: sourceAccount.id,
          to_account_id: targetAccount.id,
          amount: topupAmount,
          concept: `Topup automático (saldo: ${targetBalance}€ < ${threshold}€)`,
          timestamp: new Date(),
          status: "pending",
          is_scheduled: false,
          enabled: true,
        },
      });

      await executeTransfer(transfer.id);
      console.log(
        `[AutoTopup] Transferred €${topupAmount} from ${sourceAccount.account_label} (${config.sourceBankName}) to ${targetAccount.account_label} (${config.targetBankName}) - balance was ${targetBalance}€`
      );
    } catch (err) {
      console.error("[AutoTopup] Error:", err);
    } finally {
      this.processing = false;
    }
  }
}

export const autoTopupManager = new AutoTopupManager();
