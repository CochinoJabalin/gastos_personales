import { prisma } from "@/lib/prisma";
import { existsSync } from "fs";
import AdmZip from "adm-zip";

interface RestoreSummary {
  restored: Record<string, number>;
  skipped: Record<string, number>;
}

function extractJsonFromZip(filepath: string): Record<string, unknown> {
  const zip = new AdmZip(filepath);
  const entry = zip.getEntry("backup.json");
  if (!entry) throw new Error("backup.json not found in archive");
  return JSON.parse(entry.getData().toString("utf-8"));
}

async function restoreEntities<T extends { id: string }>(
  model: { create: (args: any) => Promise<unknown>; findUnique: (args: any) => Promise<unknown> },
  entities: T[] | undefined,
  label: string,
  summary: RestoreSummary
): Promise<void> {
  if (!entities || !Array.isArray(entities)) return;

  for (const entity of entities) {
    try {
      const existing = await model.findUnique({ where: { id: entity.id } });
      if (existing) {
        summary.skipped[label] = (summary.skipped[label] || 0) + 1;
        continue;
      }
      await model.create({ data: entity });
      summary.restored[label] = (summary.restored[label] || 0) + 1;
    } catch (err: unknown) {
      const prismaErr = err as { code?: string };
      if (prismaErr.code === "P2002") {
        summary.skipped[label] = (summary.skipped[label] || 0) + 1;
      } else {
        console.error(`[Restore] Error restoring ${label} ${entity.id}:`, err);
        summary.skipped[label] = (summary.skipped[label] || 0) + 1;
      }
    }
  }
}

export async function restoreFromBackup(filepath: string): Promise<RestoreSummary> {
  if (!existsSync(filepath)) {
    throw new Error(`Archivo de backup no encontrado: ${filepath}`);
  }

  const data = extractJsonFromZip(filepath);
  const summary: RestoreSummary = { restored: {}, skipped: {} };

  // Restore order respects foreign key dependencies

  // 1. Banks (no FK dependencies)
  await restoreEntities(
    prisma.bank,
    data.banks as { id: string }[] | undefined,
    "banks",
    summary
  );

  // Accounts are embedded in banks in v1, separate in v2
  const banksData = data.banks as Array<{ id: string; accounts?: { id: string }[] }> | undefined;
  if (banksData) {
    for (const bank of banksData) {
      if (bank.accounts && Array.isArray(bank.accounts)) {
        await restoreEntities(
          prisma.account,
          bank.accounts as { id: string }[],
          "accounts",
          summary
        );
      }
    }
  }

  // 2. Originators
  await restoreEntities(
    prisma.originator,
    data.originators as { id: string }[] | undefined,
    "originators",
    summary
  );

  // 3. InvestmentInstruments
  await restoreEntities(
    prisma.investmentInstrument,
    data.instruments as { id: string }[] | undefined,
    "instruments",
    summary
  );

  // 4. MappingRules
  await restoreEntities(
    prisma.mappingRule,
    data.mappingRules as { id: string }[] | undefined,
    "mappingRules",
    summary
  );

  // 5. Transfers
  await restoreEntities(
    prisma.transfer,
    data.transfers as { id: string }[] | undefined,
    "transfers",
    summary
  );

  // 6. CrowdlendingInvestments
  await restoreEntities(
    prisma.crowdlendingInvestment,
    data.crowdlendingInvestments as { id: string }[] | undefined,
    "crowdlendingInvestments",
    summary
  );

  // 7. CrowdlendingPayments
  await restoreEntities(
    prisma.crowdlendingPayment,
    data.crowdlendingPayments as { id: string }[] | undefined,
    "crowdlendingPayments",
    summary
  );

  // 8. InvestmentHoldings
  await restoreEntities(
    prisma.investmentHolding,
    data.investmentHoldings as { id: string }[] | undefined,
    "investmentHoldings",
    summary
  );

  // 9. InvestmentLots
  await restoreEntities(
    prisma.investmentLot,
    data.investmentLots as { id: string }[] | undefined,
    "investmentLots",
    summary
  );

  // 10. InvestmentTransactions
  await restoreEntities(
    prisma.investmentTransaction,
    data.investmentTransactions as { id: string }[] | undefined,
    "investmentTransactions",
    summary
  );

  // 11. Transactions (last because they reference almost everything)
  await restoreEntities(
    prisma.transaction,
    data.transactions as { id: string }[] | undefined,
    "transactions",
    summary
  );

  return summary;
}
