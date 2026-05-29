import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseSpanishNumber, applySign } from "@/lib/format";
import { verifyAuth, verifyCSRF } from "@/lib/api-auth";
import { processRedondeo } from "@/lib/redondeo";
import { createTransactionSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const group = searchParams.get("group");
  const bank_id = searchParams.get("bank_id");
  const type = searchParams.get("type");
  const concept = searchParams.get("concept");
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  const future = searchParams.get("future") === "true";
  const income = searchParams.get("income") === "true";

  const where: Record<string, unknown> = {};
  // Exclude transfers from operations list by default (unless specifically filtering by group)
  if (group) {
    where.group = group;
  } else {
    where.group = { not: "Transferencia" };
  }
  if (bank_id) where.bank_id = bank_id;
  if (type) where.type = type;
  if (concept) where.concept = { contains: concept, mode: "insensitive" };
  if (income) where.amount = { gt: 0 };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  if (future) {
    where.timestamp = { gte: tomorrow };
  } else if (year) {
    const y = parseInt(year);
    const start = new Date(y, month ? parseInt(month) - 1 : 0, 1);
    if (month) {
      const end = new Date(y, parseInt(month), 1);
      where.timestamp = { gte: start, lt: end };
    } else {
      const yearEnd = new Date(y + 1, 0, 1);
      const end = yearEnd > tomorrow ? tomorrow : yearEnd;
      where.timestamp = { gte: start, lt: end };
    }
  } else {
    where.timestamp = { lt: tomorrow };
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
  const auth = await verifyAuth(request);
  if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });

  if (auth.method !== "api-token" && !verifyCSRF(request)) {
    return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const { concept, bank_id, account_id, group, type, is_recurring, recurring_period, timestamp, comentarios: rawComentarios } = parsed.data;
  const comentarios = auth.method === "api-token"
    ? ("[API]" + (rawComentarios ? " " + rawComentarios : "")).trim()
    : (rawComentarios || null);

  let amount = typeof parsed.data.amount === "number" ? parsed.data.amount : parseSpanishNumber(String(parsed.data.amount));
  amount = applySign(amount, group || "");

  let resolvedAccountId = account_id;
  if (!resolvedAccountId) {
    const defaultAccount = await prisma.account.findFirst({
      where: { bank_id, is_default: true },
    });
    if (defaultAccount) resolvedAccountId = defaultAccount.id;
  }

  const transaction = await prisma.transaction.create({
    data: {
      concept,
      amount,
      bank_id,
      account_id: resolvedAccountId || null,
      group: group || "",
      type: type ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() : "",
      is_recurring: is_recurring || false,
      recurring_period: recurring_period || null,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      comentarios,
    },
    include: { bank: true, account: true },
  });

  if (resolvedAccountId) {
    await prisma.account.update({
      where: { id: resolvedAccountId },
      data: { balance: { increment: amount } },
    });
  }

  await prisma.bank.update({
    where: { id: bank_id },
    data: { balance: { increment: amount } },
  });

  await processRedondeo(amount, bank_id, resolvedAccountId ?? null);

  return NextResponse.json(transaction, { status: 201 });
}
