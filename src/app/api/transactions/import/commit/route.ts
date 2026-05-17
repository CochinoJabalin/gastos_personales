import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseSpanishNumber, applySign } from "@/lib/format";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { items } = body as {
    items: Array<{
      action: "create" | "replace";
      duplicateId?: string;
      dateStr: string; bankName: string; concept: string; comments: string | null;
      amount: number; group: string; type: string; yearNum: number; monthIdx: number; day: number;
    }>;
  };

  const allBanks = await prisma.bank.findMany();
  const bankByName = new Map(allBanks.map((b) => [b.bank_name.toLowerCase(), b]));

  let created = 0;
  let replaced = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      const bank = bankByName.get(item.bankName.toLowerCase());
      if (!bank) {
        errors.push(`Banco no encontrado: ${item.bankName}`);
        continue;
      }

      const finalAmount = applySign(item.amount, item.group);
      const dateObj = new Date(item.yearNum, item.monthIdx, item.day);

      if (item.action === "replace" && item.duplicateId) {
        await prisma.transaction.update({
          where: { id: item.duplicateId },
          data: {
            concept: item.concept,
            amount: finalAmount,
            bank_id: bank.id,
            group: item.group,
            type: item.type,
            timestamp: dateObj,
            comentarios: item.comments,
          },
        });
        replaced++;
      } else {
        await prisma.transaction.create({
          data: {
            concept: item.concept,
            amount: finalAmount,
            bank_id: bank.id,
            group: item.group,
            type: item.type,
            timestamp: dateObj,
            comentarios: item.comments,
          },
        });
        created++;
      }
    } catch {
      errors.push(`Error al procesar: ${item.concept}`);
    }
  }

  return NextResponse.json({ created, replaced, errors });
}
