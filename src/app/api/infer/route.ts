import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { concept } = await request.json();
  if (!concept) {
    return NextResponse.json({ error: "Concepto requerido" }, { status: 400 });
  }

  const rule = await prisma.mappingRule.findFirst({
    where: {
      pattern: { contains: concept, mode: "insensitive" },
    },
    orderBy: { pattern: "asc" },
    include: { default_bank: true },
  });

  if (!rule) {
    const allRules = await prisma.mappingRule.findMany({
      include: { default_bank: true },
    });
    const matchingRule = allRules.find(r => 
      concept.toLowerCase().includes(r.pattern.toLowerCase())
    );
    if (matchingRule) {
      const lastTx = await prisma.transaction.findFirst({
        where: { concept: { equals: concept, mode: "insensitive" } },
        orderBy: { timestamp: "desc" },
        include: { bank: true },
      });

      return NextResponse.json({
        source: "mapping_rule",
        bank_id: lastTx?.bank_id ?? matchingRule.default_bank_id,
        bank_name: lastTx?.bank?.bank_name ?? matchingRule.default_bank?.bank_name ?? null,
        group: matchingRule.default_group,
        type: matchingRule.default_type,
      });
    }
  }

  if (rule) {
    const lastTx = await prisma.transaction.findFirst({
      where: { concept: { equals: concept, mode: "insensitive" } },
      orderBy: { timestamp: "desc" },
      include: { bank: true },
    });

    return NextResponse.json({
      source: "mapping_rule",
      bank_id: lastTx?.bank_id ?? rule.default_bank_id,
      bank_name: lastTx?.bank?.bank_name ?? rule.default_bank?.bank_name ?? null,
      group: rule.default_group,
      type: rule.default_type,
    });
  }

  const exactTx = await prisma.transaction.findFirst({
    where: { concept: { equals: concept, mode: "insensitive" } },
    orderBy: { timestamp: "desc" },
    include: { bank: true },
  });

  if (exactTx) {
    return NextResponse.json({
      source: "history",
      bank_id: exactTx.bank_id,
      bank_name: exactTx.bank?.bank_name ?? null,
      group: exactTx.group,
      type: exactTx.type,
    });
  }

  const recent = await prisma.transaction.findMany({
    where: {
      concept: { contains: concept, mode: "insensitive" },
    },
    include: { bank: true },
    orderBy: { timestamp: "desc" },
    take: 5,
  });

  if (recent.length > 0) {
    const groups = recent.map((t) => t.group);
    const types = recent.map((t) => t.type);
    const bankIds = recent.map((t) => t.bank_id);

    const mostFrequentGroup = mode(groups);
    const mostFrequentType = mode(types);
    const mostFrequentBankId = mode(bankIds);
    const mostFrequentBank = recent.find(
      (t) => t.bank_id === mostFrequentBankId
    )?.bank;

    return NextResponse.json({
      source: "history",
      bank_id: mostFrequentBankId,
      bank_name: mostFrequentBank?.bank_name || "Desconocido",
      group: mostFrequentGroup || "Ocio",
      type: mostFrequentType || "Variable",
    });
  }

  return NextResponse.json({
    source: "default",
    bank_id: null,
    bank_name: null,
    group: "Ocio",
    type: "Variable",
  });
}

function mode(arr: string[]): string {
  const freq: Record<string, number> = {};
  let maxFreq = 0;
  let mostFreq = arr[0];
  for (const item of arr) {
    freq[item] = (freq[item] || 0) + 1;
    if (freq[item] > maxFreq) {
      maxFreq = freq[item];
      mostFreq = item;
    }
  }
  return mostFreq;
}
