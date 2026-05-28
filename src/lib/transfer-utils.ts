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

  // Check if there's an existing scheduled execution for this date
  // If so, update it to completed; otherwise create a new one
  const existingScheduled = await prisma.transferExecution.findFirst({
    where: {
      transfer_id: transfer.id,
      status: "scheduled",
      scheduled_for: { lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) }, // Within 24 hours
    },
    orderBy: { scheduled_for: "asc" },
  });

  if (existingScheduled) {
    // Update existing scheduled execution to completed
    await prisma.transferExecution.update({
      where: { id: existingScheduled.id },
      data: {
        executed_at: now,
        amount: transferAmount,
        from_balance_before: fromBalanceBefore,
        from_balance_after: fromBalanceAfter,
        to_balance_before: toBalanceBefore,
        to_balance_after: toBalanceAfter,
        status: "completed",
      },
    });
  } else {
    // Create new execution record with balance snapshots
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
  }

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

  // Regenerate scheduled executions for this transfer (all frequencies)
  if (transfer.is_scheduled && transfer.frequency) {
    await generateScheduledExecutions(transfer.id, 3);
  }
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

  // Check if there's an existing scheduled execution for this date
  // If so, update it to completed; otherwise create a new one
  const existingScheduled = await prisma.transferExecution.findFirst({
    where: {
      transfer_id: transfer.id,
      status: "scheduled",
      scheduled_for: { lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) }, // Within 24 hours
    },
    orderBy: { scheduled_for: "asc" },
  });

  if (existingScheduled) {
    // Update existing scheduled execution to completed
    await prisma.transferExecution.update({
      where: { id: existingScheduled.id },
      data: {
        executed_at: now,
        amount: netRounded,
        from_balance_before: balanceBefore,
        from_balance_after: balanceAfter,
        to_balance_before: balanceBefore,
        to_balance_after: balanceAfter,
        status: "completed",
      },
    });
  } else {
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
  }

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

  // Regenerate scheduled executions for this transfer
  if (transfer.is_scheduled && transfer.frequency) {
    await generateScheduledExecutions(transfer.id, 3);
  }

  console.log(
    `[InterestScheduler] Paid ${netRounded.toFixed(2)}€ to ${account.account_label} (bruto: ${grossRounded.toFixed(2)}€, retención 19%: ${withholdingRounded.toFixed(2)}€)`
  );
}

/**
 * Mark past scheduled executions as completed/skipped for a transfer.
 * This ensures the UI shows the correct status for executions that have passed.
 */
async function markPastScheduledExecutionsAsCompleted(
  transferId: string,
  now: Date,
  amount: number = 0
): Promise<void> {
  // Find all scheduled executions that are past due
  const pastScheduled = await prisma.transferExecution.findMany({
    where: {
      transfer_id: transferId,
      status: "scheduled",
      scheduled_for: { lte: now },
    },
  });

  // Update each to completed
  for (const exec of pastScheduled) {
    await prisma.transferExecution.update({
      where: { id: exec.id },
      data: {
        status: "completed",
        executed_at: now,
        amount: amount,
      },
    });
  }
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
  // Mark past scheduled executions as completed (with 0 amount since no actual payment)
  await markPastScheduledExecutionsAsCompleted(transfer.id, now, 0);

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

  // Regenerate scheduled executions for this transfer
  if (transfer.is_scheduled && transfer.frequency) {
    await generateScheduledExecutions(transfer.id, 3);
  }
}

export function calculateNextRun(frequency: string, fromDate: Date): Date {
  const next = new Date(fromDate);
  if (frequency === "diario") {
    // Next day at 09:00
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
    return next;
  } else if (frequency === "mensual") {
    // Always day 01 of the next month at 00:00
    next.setMonth(next.getMonth() + 1);
    next.setDate(1);
    next.setHours(0, 0, 0, 0);
  } else if (frequency === "anual") {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next;
}

/**
 * Calculate the first next_run date for a monthly transfer.
 * Always sets to day 01 of the next applicable month.
 */
export function calculateFirstMonthlyRun(fromDate: Date): Date {
  const now = new Date();
  const date = new Date(fromDate);
  
  // If the date is in the past or current month but past day 1
  if (date <= now) {
    // Set to day 01 of next month
    date.setMonth(date.getMonth() + 1);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
  } else {
    // If in future, set to day 01 of that month
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    // If the resulting date is in the past (e.g., we're on Jan 15, date was Jan 20, setting to Jan 1 makes it past)
    if (date <= now) {
      date.setMonth(date.getMonth() + 1);
    }
  }
  
  return date;
}

/**
 * Fix all existing monthly transfers to have next_run on day 01.
 * Returns the number of transfers fixed.
 */
export async function fixMonthlyTransferDates(): Promise<number> {
  const monthlyTransfers = await prisma.transfer.findMany({
    where: {
      frequency: "mensual",
      is_scheduled: true,
      enabled: true,
      status: "pending",
    },
  });

  let fixedCount = 0;
  const now = new Date();

  for (const transfer of monthlyTransfers) {
    if (!transfer.next_run) continue;
    
    const currentNextRun = new Date(transfer.next_run);
    
    // Check if it's not day 01
    if (currentNextRun.getDate() !== 1) {
      // Calculate the correct next_run (day 01 of next applicable month)
      const correctedNextRun = new Date(currentNextRun);
      correctedNextRun.setDate(1);
      correctedNextRun.setHours(0, 0, 0, 0);
      
      // If the corrected date is in the past, move to next month
      if (correctedNextRun <= now) {
        correctedNextRun.setMonth(correctedNextRun.getMonth() + 1);
      }
      
      await prisma.transfer.update({
        where: { id: transfer.id },
        data: { next_run: correctedNextRun },
      });
      
      console.log(
        `[FixMonthlyDates] Fixed transfer ${transfer.id}: ${currentNextRun.toISOString()} -> ${correctedNextRun.toISOString()}`
      );
      fixedCount++;
    }
  }

  return fixedCount;
}

/**
 * Generate scheduled executions for a transfer.
 * - For daily: generates for the next 90 days (3 months equivalent)
 * - For monthly: generates for the next 3 months
 * - For annual: generates for the next 3 years
 * These executions have status "scheduled" and will be converted to "completed" when executed.
 */
export async function generateScheduledExecutions(
  transferId: string,
  periodsAhead: number = 3
): Promise<number> {
  const transfer = await prisma.transfer.findUnique({
    where: { id: transferId },
    include: {
      from_account: true,
      to_account: true,
    },
  });

  if (!transfer || !transfer.is_scheduled || !transfer.frequency) {
    return 0;
  }

  // Delete any existing scheduled (not completed) executions for this transfer
  await prisma.transferExecution.deleteMany({
    where: {
      transfer_id: transferId,
      status: "scheduled",
    },
  });

  const fromBalance = Number(transfer.from_account.balance);
  const toBalance = Number(transfer.to_account.balance);
  
  // Check if this is an interest payment (same account)
  const isInterestPayment = transfer.from_account_id === transfer.to_account_id;

  // Calculate amount per period
  let transferAmount: number;
  if (isInterestPayment) {
    const account = transfer.from_account;
    const rate = Number(account.interest_rate) / 100;
    const balance = Number(account.balance);
    
    if (balance <= 0 || rate <= 0) {
      transferAmount = 0;
    } else {
      let interestGross = 0;
      if (account.interest_period === "daily") {
        interestGross = balance * rate / 360;
      } else if (account.interest_period === "monthly") {
        interestGross = balance * rate / 12;
      }
      const withholding = interestGross * WITHHOLDING_RATE;
      const interestNet = interestGross - withholding;
      transferAmount = Math.round(interestNet * 100) / 100;
    }
  } else {
    transferAmount = Number(transfer.amount);
  }

  let currentDate = transfer.next_run ? new Date(transfer.next_run) : new Date();
  const endDate = transfer.end_date ? new Date(transfer.end_date) : null;
  
  // Calculate how many iterations based on frequency
  let iterations: number;
  if (transfer.frequency === "diario") {
    iterations = periodsAhead * 30; // ~90 days for 3 "months"
  } else if (transfer.frequency === "mensual") {
    iterations = periodsAhead; // 3 months
  } else if (transfer.frequency === "anual") {
    iterations = periodsAhead; // 3 years
  } else {
    iterations = periodsAhead;
  }

  const executionsToCreate: {
    transfer_id: string;
    scheduled_for: Date;
    amount: number;
    from_balance_before: number;
    from_balance_after: number;
    to_balance_before: number;
    to_balance_after: number;
    status: string;
  }[] = [];

  // Calculate projected balances
  let projectedFromBalance = fromBalance;
  let projectedToBalance = toBalance;

  for (let i = 0; i < iterations; i++) {
    // Check if we've passed the end date
    if (endDate && currentDate > endDate) {
      break;
    }

    const fromBalanceBefore = projectedFromBalance;
    const toBalanceBefore = projectedToBalance;
    
    // For interest payments, the amount adds to the same account
    // For regular transfers, it subtracts from source and adds to destination
    let fromBalanceAfter: number;
    let toBalanceAfter: number;
    
    if (isInterestPayment) {
      // Interest payment: amount is added to the account
      fromBalanceAfter = fromBalanceBefore + transferAmount;
      toBalanceAfter = toBalanceBefore + transferAmount;
    } else {
      // Regular transfer: subtract from source, add to destination
      fromBalanceAfter = fromBalanceBefore - transferAmount;
      toBalanceAfter = toBalanceBefore + transferAmount;
    }

    executionsToCreate.push({
      transfer_id: transferId,
      scheduled_for: new Date(currentDate),
      amount: transferAmount,
      from_balance_before: fromBalanceBefore,
      from_balance_after: fromBalanceAfter,
      to_balance_before: toBalanceBefore,
      to_balance_after: toBalanceAfter,
      status: "scheduled",
    });

    // Update projected balances for next iteration
    projectedFromBalance = fromBalanceAfter;
    projectedToBalance = toBalanceAfter;

    // Calculate next date
    currentDate = calculateNextRun(transfer.frequency, currentDate);
  }

  // Create all scheduled executions
  if (executionsToCreate.length > 0) {
    await prisma.transferExecution.createMany({
      data: executionsToCreate,
    });
  }

  return executionsToCreate.length;
}

/**
 * Regenerate scheduled executions for all active scheduled transfers.
 * Includes daily, monthly, and annual frequencies, including interest payments.
 * Call this after any transfer is modified or executed.
 */
export async function regenerateAllScheduledExecutions(periodsAhead: number = 3): Promise<number> {
  const scheduledTransfers = await prisma.transfer.findMany({
    where: {
      is_scheduled: true,
      enabled: true,
      status: "pending",
      frequency: { in: ["diario", "mensual", "anual"] },
    },
  });

  let totalCreated = 0;
  for (const transfer of scheduledTransfers) {
    const created = await generateScheduledExecutions(transfer.id, periodsAhead);
    totalCreated += created;
  }

  return totalCreated;
}
