import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseSpanishNumber, applySign } from "@/lib/format";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const group = searchParams.get("group");
  const bank_id = searchParams.get("bank_id");
  const type = searchParams.get("type");
  const concept = searchParams.get("concept");
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  const where: Record<string, unknown> = {};
  if (group) where.group = group;
  if (bank_id) where.bank_id = bank_id;
  if (type) where.type = type;
  if (concept) where.concept = { contains: concept };

  if (year) {
    const y = parseInt(year);
    const start = new Date(y, month ? parseInt(month) - 1 : 0, 1);
    const end = month
      ? new Date(y, parseInt(month), 1)
      : new Date(y + 1, 0, 1);
    where.timestamp = { gte: start, lt: end };
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { bank: true },
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return NextResponse.json({
    data: transactions,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();

  let amount = typeof body.amount === "number" ? body.amount : parseSpanishNumber(body.amount);
  amount = applySign(amount, body.group);

  const transaction = await prisma.transaction.create({
    data: {
      concept: body.concept,
      amount,
      bank_id: body.bank_id,
      group: body.group,
      type: body.type,
      is_recurring: body.is_recurring || false,
      recurring_period: body.recurring_period || null,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
      comentarios: body.comentarios || null,
    },
    include: { bank: true },
  });

  return NextResponse.json(transaction, { status: 201 });
}
