import { prisma } from "@/lib/prisma";

const WITHHOLDING_RATE = 0.19;

export async function executeTransfer(transferId: string): Promise<void> {
  const transfer = await prisma.transfer.findUnique({
    where: { id: transferId },
    include: {
      from_account: { include: { bank: true } },
      to_account: { include: { bank: true } },
    },
  });

  if (!transfer || transfer.status !== "pending" || !transfer.enabled) return;

  const now = new Date();

  // Interest payment: from_account === to_account
  if (transfer.from_account_id === transfer.to_account_id) {
    await executeInterestPayment(transfer, now);
    return;
  }

  // Capture balances BEFORE transfer
  const fromBalanceBefore = Number(transfer.from_account.balance);
  const toBalanceBefore = Number(transfer.to_account.balance);
  const transferAmount = Number(transfer.amount);

  // Normal transfer logic
  const sameBank = transfer.from_account.bank_id === transfer.to_account.bank_id;

  // Create debit transaction (negative)
  await prisma.transaction.create({
    data: {
      concept: transfer.concept,
      amount: -transferAmount,
      bank_id: transfer.from_account.bank_id,
      account_id: transfer.from_account_id,
      group: "Transferencia",
      type: "Variable",
      timestamp: now,
      transfer_id: transfer.id,
      comentarios: `Transferencia a ${transfer.to_account.account_label}`,
    },
  });

  // Create credit transaction (positive)
  await prisma.transaction.create({
    data: {
      concept: transfer.concept,
      amount: transferAmount,
      bank_id: transfer.to_account.bank_id,
      account_id: transfer.to_account_id,
      group: "Transferencia",
      type: "Variable",
      timestamp: now,
      transfer_id: transfer.id,
      comentarios: `Transferencia desde ${transfer.from_account.account_label}`,
    },
  });

  // Update source account balance
  await prisma.account.update({
    where: { id: transfer.from_account_id },
    data: { balance: { decrement: transferAmount } },
  });

  // Update destination account balance
  await prisma.account.update({
    where: { id: transfer.to_account_id },
    data: { balance: { increment: transferAmount } },
  });

  // Update source bank balance
  await prisma.bank.update({
    where: { id: transfer.from_account.bank_id },
    data: { balance: { decrement: transferAmount } },
  });

  // Update destination bank balance (if different bank)
  if (!sameBank) {
    await prisma.bank.update({
      where: { id: transfer.to_account.bank_id },
      data: { balance: { increment: transferAmount } },
    });
  }

  // Calculate balances AFTER transfer
  const fromBalanceAfter = fromBalanceBefore - transferAmount;
  const toBalanceAfter = toBalanceBefore + transferAmount;

  // Create execution record with balance snapshots
  await prisma.transferExecution.create({
    data: {
      transfer_id: transfer.id,
      executed_at: now,
      amount: transferAmount,
      from_balance_before: fromBalanceBefore,
      from_balance_after: fromBalanceAfter,
      to_balance_before: toBalanceBefore,
      to_balance_after: toBalanceAfter,
      status: "completed",
    },
  });

  // Calculate next run for scheduled transfers
  let nextRun: Date | null = null;
  let enabled = true;
  let status = "completed";

  if (transfer.is_scheduled && transfer.frequency) {
    nextRun = calculateNextRun(transfer.frequency, transfer.next_run || transfer.timestamp);
    if (transfer.end_date && nextRun > transfer.end_date) {
      nextRun = null;
      enabled = false;
    }
    status = "pending";
  }

  await prisma.transfer.update({
    where: { id: transfer.id },
    data: {
      status,
      last_run: now,
      next_run: nextRun,
      enabled,
    },
  });
}

/**
 * Execute an interest payment transfer.
 * Calculates interest based on account balance and rate,
 * applies 19% IRPF withholding, credits net to account.
 * Does NOT create transactions - only updates balances.
 */
async function executeInterestPayment(
  transfer: {
    id: string;
    from_account_id: string;
    to_account_id: string;
    is_scheduled: boolean;
    frequency: string | null;
    next_run: Date | null;
    end_date: Date | null;
    timestamp: Date;
    concept: string;
    from_account: {
      id: string;
      bank_id: string;
      account_label: string;
      balance: number | { toNumber?: () => number };
      interest_rate: number | { toNumber?: () => number };
      interest_period: string;
      last_interest_date: Date | null;
      created_at: Date;
      bank: { id: string; bank_name: string };
    };
    to_account: {
      id: string;
      bank_id: string;
      account_label: string;
      bank: { id: string; bank_name: string };
    };
  },
  now: Date
): Promise<void> {
  const account = transfer.from_account;
  const rate = Number(account.interest_rate) / 100;
  const balance = Number(account.balance);

  if (balance <= 0 || rate <= 0) {
    // Still advance the schedule even if nothing to pay
    await advanceSchedule(transfer, now);
    return;
  }

  const lastDate = account.last_interest_date || account.created_at;
  const daysDiff = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff < 1) {
    await advanceSchedule(transfer, now);
    return;
  }

  // Calculate gross interest
  let interestGross = 0;
  if (account.interest_period === "daily") {
    interestGross = balance * rate * daysDiff / 360;
  } else if (account.interest_period === "monthly") {
    const monthsDiff = Math.max(1, Math.floor(daysDiff / 30));
    interestGross = balance * rate * monthsDiff / 12;
  }

  if (interestGross <= 0) {
    await advanceSchedule(transfer, now);
    return;
  }

  const withholding = interestGross * WITHHOLDING_RATE;
  const interestNet = interestGross - withholding;
  const netRounded = Math.round(interestNet * 100) / 100;
  const grossRounded = Math.round(interestGross * 100) / 100;
  const withholdingRounded = Math.round(withholding * 100) / 100;

  if (netRounded <= 0) {
    await advanceSchedule(transfer, now);
    return;
  }

  // Capture balances BEFORE interest payment
  const balanceBefore = balance;
  const balanceAfter = balance + netRounded;

  // Update account balance with net interest
  await prisma.account.update({
    where: { id: account.id },
    data: {
      balance: { increment: netRounded },
      last_interest_date: now,
    },
  });

  // Update bank balance
  const agg = await prisma.account.aggregate({
    where: { bank_id: account.bank_id },
    _sum: { balance: true },
  });
  await prisma.bank.update({
    where: { id: account.bank_id },
    data: { balance: agg._sum.balance ?? 0 },
  });

  // Create execution record for interest payment
  await prisma.transferExecution.create({
    data: {
      transfer_id: transfer.id,
      executed_at: now,
      amount: netRounded,
      from_balance_before: balanceBefore,
      from_balance_after: balanceAfter,
      to_balance_before: balanceBefore, // Same account for interest
      to_balance_after: balanceAfter,
      status: "completed",
    },
  });

  // Update transfer with the actual amount paid and advance schedule
  let nextRun: Date | null = null;
  let enabled = true;
  let status = "completed";

  if (transfer.is_scheduled && transfer.frequency) {
    nextRun = calculateNextRun(transfer.frequency, transfer.next_run || transfer.timestamp);
    if (transfer.end_date && nextRun > transfer.end_date) {
      nextRun = null;
      enabled = false;
    }
    status = "pending";
  }

  await prisma.transfer.update({
    where: { id: transfer.id },
    data: {
      amount: netRounded,
      status,
      last_run: now,
      next_run: nextRun,
      enabled,
    },
  });

  console.log(
    `[InterestScheduler] Paid ${netRounded.toFixed(2)}€ to ${account.account_label} (bruto: ${grossRounded.toFixed(2)}€, retención 19%: ${withholdingRounded.toFixed(2)}€)`
  );
}

async function advanceSchedule(
  transfer: {
    id: string;
    is_scheduled: boolean;
    frequency: string | null;
    next_run: Date | null;
    end_date: Date | null;
    timestamp: Date;
  },
  now: Date
): Promise<void> {
  let nextRun: Date | null = null;
  let enabled = true;
  let status = "completed";

  if (transfer.is_scheduled && transfer.frequency) {
    nextRun = calculateNextRun(transfer.frequency, transfer.next_run || transfer.timestamp);
    if (transfer.end_date && nextRun > transfer.end_date) {
      nextRun = null;
      enabled = false;
    }
    status = "pending";
  }

  await prisma.transfer.update({
    where: { id: transfer.id },
    data: {
      status,
      last_run: now,
      next_run: nextRun,
      enabled,
    },
  });
}

function calculateNextRun(frequency: string, fromDate: Date): Date {
  const next = new Date(fromDate);
  if (frequency === "diario") {
    // Daily transfers run at 09:00
    const now = new Date();
    const today9 = new Date(now);
    today9.setHours(9, 0, 0, 0);
    if (now < today9) {
      return today9;
    }
    const tomorrow9 = new Date(today9);
    tomorrow9.setDate(tomorrow9.getDate() + 1);
    return tomorrow9;
  } else if (frequency === "mensual") {
    next.setMonth(next.getMonth() + 1);
  } else if (frequency === "anual") {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next;
}
