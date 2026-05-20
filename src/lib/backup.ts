import { prisma } from "@/lib/prisma";
import archiver from "archiver";
import { createWriteStream, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

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
  includeTransactions?: boolean;
  includeMappingRules?: boolean;
  includeBanks?: boolean;
  targetDir?: string;
}

export interface BackupResult {
  filename: string;
  filepath: string;
  size: number;
  stats: {
    transactions: number;
    mappingRules: number;
    banks: number;
  };
}

export async function createBackup(options: BackupOptions = {}): Promise<BackupResult> {
  const {
    includeTransactions = true,
    includeMappingRules = true,
    includeBanks = true,
    targetDir = "/backups",
  } = options;

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  const timestamp = formatDate(new Date());
  const filename = `backup_${timestamp}.zip`;
  const filepath = join(targetDir, filename);

  const data: Record<string, unknown> = {};

  if (includeTransactions) {
    const transactions = await prisma.transaction.findMany({
      include: { bank: true, account: true },
      orderBy: { timestamp: "desc" },
    });
    data.transactions = transactions.map((t) => ({
      id: t.id,
      timestamp: t.timestamp,
      concept: t.concept,
      amount: Number(t.amount),
      bank: t.bank?.bank_name ?? null,
      account: t.account?.account_label ?? null,
      group: t.group,
      type: t.type,
      is_recurring: t.is_recurring,
      recurring_period: t.recurring_period,
      comentarios: t.comentarios,
    }));
  }

  if (includeMappingRules) {
    const rules = await prisma.mappingRule.findMany({
      include: { default_bank: true },
      orderBy: { pattern: "asc" },
    });
    data.mappingRules = rules.map((r) => ({
      id: r.id,
      pattern: r.pattern,
      default_bank: r.default_bank?.bank_name ?? null,
      default_group: r.default_group,
      default_type: r.default_type,
    }));
  }

  if (includeBanks) {
    const banks = await prisma.bank.findMany({
      include: { accounts: true },
      orderBy: { bank_name: "asc" },
    });
    data.banks = banks.map((b) => ({
      id: b.id,
      bank_name: b.bank_name,
      account_label: b.account_label,
      iban: b.iban,
      balance: Number(b.balance),
      created_at: b.created_at,
      accounts: b.accounts.map((a) => ({
        id: a.id,
        account_label: a.account_label,
        iban: a.iban,
        balance: Number(a.balance),
        is_default: a.is_default,
        interest_rate: Number(a.interest_rate),
        interest_period: a.interest_period,
        last_interest_date: a.last_interest_date,
        created_at: a.created_at,
      })),
    }));
  }

  data.exportedAt = new Date().toISOString();
  data.version = "1.0";

  return new Promise((resolve, reject) => {
    const output = createWriteStream(filepath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", async () => {
      const stats: BackupResult["stats"] = {
        transactions: (data.transactions as unknown[])?.length ?? 0,
        mappingRules: (data.mappingRules as unknown[])?.length ?? 0,
        banks: (data.banks as unknown[])?.length ?? 0,
      };

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
