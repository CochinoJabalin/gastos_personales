import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const [transactions, mappingRules] = await Promise.all([
    prisma.transaction.findMany({
      orderBy: { timestamp: "desc" },
      take: 500,
      include: { bank: true },
    }),
    prisma.mappingRule.findMany({
      select: { pattern: true, default_group: true },
    }),
  ]);

  // Find the matching mapping rule's default_group for a given concept
  function findRuleGroup(concept: string): string | undefined {
    const lower = concept.toLowerCase();
    for (const rule of mappingRules) {
      if (lower.includes(rule.pattern.toLowerCase())) {
        return rule.default_group;
      }
    }
    return undefined;
  }

  const freq = new Map<string, { concept: string; group: string; type: string; bank_id: string; bank_name: string | null; count: number }>();
  for (const t of transactions) {
    const key = t.concept.toLowerCase();
    if (freq.has(key)) {
      freq.get(key)!.count++;
    } else {
      // Use mapping rule category if available, otherwise fall back to transaction's group
      const group = findRuleGroup(t.concept) || t.group;
      freq.set(key, {
        concept: t.concept,
        group,
        type: t.type,
        bank_id: t.bank_id,
        bank_name: t.bank?.bank_name || null,
        count: 1,
      });
    }
  }

  const common = [...freq.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json(common);
}
