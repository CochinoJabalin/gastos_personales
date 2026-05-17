import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const transactions = await prisma.transaction.findMany({
    orderBy: { timestamp: "desc" },
    take: 500,
    include: { bank: true },
  });

  const freq = new Map<string, { concept: string; group: string; type: string; bank_id: string; bank_name: string | null; count: number }>();
  for (const t of transactions) {
    const key = t.concept.toLowerCase();
    if (freq.has(key)) {
      freq.get(key)!.count++;
    } else {
      freq.set(key, {
        concept: t.concept,
        group: t.group,
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
