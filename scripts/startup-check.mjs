import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
  try {
    const [txCount, bankCount, accountCount, ruleCount] = await Promise.all([
      prisma.transaction.count(),
      prisma.bank.count(),
      prisma.account.count(),
      prisma.mappingRule.count(),
    ]);

    console.log(`[startup] Transaction count: ${txCount}`);
    console.log(`[startup] Bank count: ${bankCount}`);
    console.log(`[startup] Account count: ${accountCount}`);
    console.log(`[startup] MappingRule count: ${ruleCount}`);

    if (txCount === 0) {
      console.warn("[startup] WARNING: No transactions found in database");
    }
  } catch (err) {
    console.error("[startup] ERROR connecting to database:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

check();
