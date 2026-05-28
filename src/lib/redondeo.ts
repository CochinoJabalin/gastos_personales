import { prisma } from "@/lib/prisma";

export async function processRedondeo(
  amount: number,
  bankId: string,
  accountId: string | null
): Promise<void> {
  if (amount >= 0) return;

  const config = await prisma.redondeoConfig.findFirst();
  if (!config || !config.enabled) return;

  const bank = await prisma.bank.findUnique({ where: { id: bankId } });
  if (!bank || bank.bank_name !== "Revolut") return;

  const sourceAccount = await prisma.account.findFirst({
    where: { bank_id: bankId, is_default: true },
  });
  if (!sourceAccount || sourceAccount.id !== accountId) return;

  const targetAccount = await prisma.account.findUnique({
    where: { id: config.target_account_id },
  });
  if (!targetAccount) return;

  const absAmount = Math.abs(amount);
  const redondeoAmount = (Math.ceil(absAmount) - absAmount) * config.multiplier;

  if (redondeoAmount <= 0) return;

  await prisma.transaction.create({
    data: {
      concept: `Redondeo (${absAmount.toFixed(2)}€ × ${config.multiplier})`,
      amount: -redondeoAmount,
      bank_id: sourceAccount.bank_id,
      account_id: sourceAccount.id,
      group: "Transferencia",
      type: "Variable",
      timestamp: new Date(),
      comentarios: `Transferencia desde ${sourceAccount.account_label}`,
    },
  });

  // Create the credit transaction for the target account
  await prisma.transaction.create({
    data: {
      concept: `Redondeo (${absAmount.toFixed(2)}€ × ${config.multiplier})`,
      amount: redondeoAmount,
      bank_id: targetAccount.bank_id,
      account_id: targetAccount.id,
      group: "Transferencia",
      type: "Variable",
      timestamp: new Date(),
      comentarios: `Transferencia a ${targetAccount.account_label}`,
    },
  });

  await prisma.account.update({
    where: { id: sourceAccount.id },
    data: { balance: { decrement: redondeoAmount } },
  });

  await prisma.account.update({
    where: { id: targetAccount.id },
    data: { balance: { increment: redondeoAmount } },
  });

  if (sourceAccount.bank_id !== targetAccount.bank_id) {
    await prisma.bank.update({
      where: { id: sourceAccount.bank_id },
      data: { balance: { decrement: redondeoAmount } },
    });
    await prisma.bank.update({
      where: { id: targetAccount.bank_id },
      data: { balance: { increment: redondeoAmount } },
    });
  }
}
