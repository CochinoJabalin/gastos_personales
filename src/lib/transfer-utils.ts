import { prisma } from "@/lib/prisma";

export async function executeTransfer(transferId: string): Promise<void> {
  const transfer = await prisma.transfer.findUnique({
    where: { id: transferId },
    include: {
      from_account: { include: { bank: true } },
      to_account: { include: { bank: true } },
    },
  });

  if (!transfer || transfer.status !== "pending" || !transfer.enabled) return;

  const sameBank = transfer.from_account.bank_id === transfer.to_account.bank_id;
  const now = new Date();

  // Create debit transaction (negative)
  await prisma.transaction.create({
    data: {
      concept: transfer.concept,
      amount: -transfer.amount,
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
      amount: transfer.amount,
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
    data: { balance: { decrement: transfer.amount } },
  });

  // Update destination account balance
  await prisma.account.update({
    where: { id: transfer.to_account_id },
    data: { balance: { increment: transfer.amount } },
  });

  // Update source bank balance
  await prisma.bank.update({
    where: { id: transfer.from_account.bank_id },
    data: { balance: { decrement: transfer.amount } },
  });

  // Update destination bank balance (if different bank)
  if (!sameBank) {
    await prisma.bank.update({
      where: { id: transfer.to_account.bank_id },
      data: { balance: { increment: transfer.amount } },
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
}

function calculateNextRun(frequency: string, fromDate: Date): Date {
  const next = new Date(fromDate);
  if (frequency === "mensual") {
    next.setMonth(next.getMonth() + 1);
  } else if (frequency === "anual") {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next;
}
