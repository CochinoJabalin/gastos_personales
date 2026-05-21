import { prisma } from "@/lib/prisma";
import archiver from "archiver";
import { createWriteStream, existsSync, mkdirSync } from "fs";
import { join } from "path";

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}_${hh}${mm}${ss}`;
}

export interface BackupOptions {
  targetDir?: string;
}

export interface BackupResult {
  filename: string;
  filepath: string;
  size: number;
  stats: Record<string, number>;
}

export async function createBackup(options: BackupOptions = {}): Promise<BackupResult> {
  const { targetDir = "/backups" } = options;

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  const timestamp = formatDate(new Date());
  const filename = `backup_${timestamp}.zip`;
  const filepath = join(targetDir, filename);

  const data: Record<string, unknown> = {};
  const stats: Record<string, number> = {};

  const banks = await prisma.bank.findMany({
    include: { accounts: true },
    orderBy: { bank_name: "asc" },
  });
  data.banks = banks;
  stats.banks = banks.length;
  stats.accounts = banks.reduce((sum, b) => sum + b.accounts.length, 0);

  const originators = await prisma.originator.findMany({ orderBy: { name: "asc" } });
  data.originators = originators;
  stats.originators = originators.length;

  const instruments = await prisma.investmentInstrument.findMany({ orderBy: { ticker: "asc" } });
  data.instruments = instruments;
  stats.instruments = instruments.length;

  const mappingRules = await prisma.mappingRule.findMany({ orderBy: { pattern: "asc" } });
  data.mappingRules = mappingRules;
  stats.mappingRules = mappingRules.length;

  const transfers = await prisma.transfer.findMany({ orderBy: { created_at: "desc" } });
  data.transfers = transfers;
  stats.transfers = transfers.length;

  const crowdlendingInvestments = await prisma.crowdlendingInvestment.findMany({
    orderBy: { fecha_inicio: "desc" },
  });
  data.crowdlendingInvestments = crowdlendingInvestments;
  stats.crowdlendingInvestments = crowdlendingInvestments.length;

  const crowdlendingPayments = await prisma.crowdlendingPayment.findMany({
    orderBy: { fecha: "desc" },
  });
  data.crowdlendingPayments = crowdlendingPayments;
  stats.crowdlendingPayments = crowdlendingPayments.length;

  const investmentHoldings = await prisma.investmentHolding.findMany({ orderBy: { created_at: "desc" } });
  data.investmentHoldings = investmentHoldings;
  stats.investmentHoldings = investmentHoldings.length;

  const investmentLots = await prisma.investmentLot.findMany({ orderBy: { fecha_compra: "desc" } });
  data.investmentLots = investmentLots;
  stats.investmentLots = investmentLots.length;

  const investmentTransactions = await prisma.investmentTransaction.findMany({
    orderBy: { date: "desc" },
  });
  data.investmentTransactions = investmentTransactions;
  stats.investmentTransactions = investmentTransactions.length;

  const transactions = await prisma.transaction.findMany({
    orderBy: { timestamp: "desc" },
  });
  data.transactions = transactions;
  stats.transactions = transactions.length;

  data.exportedAt = new Date().toISOString();
  data.version = "2.0";

  return new Promise((resolve, reject) => {
    const output = createWriteStream(filepath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      resolve({
        filename,
        filepath,
        size: archive.pointer(),
        stats,
      });
    });

    archive.on("error", (err) => reject(err));

    archive.pipe(output);
    archive.append(JSON.stringify(data, null, 2), { name: "backup.json" });
    archive.finalize();
  });
}

export function getBackupPath(filepath: string): string {
  return filepath;
}
