import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { transferScheduler } from "@/lib/transfer-scheduler";
import { autoTopupManager } from "@/lib/auto-topup";
import { executeTransfer } from "@/lib/transfer-utils";

export const dynamic = "force-dynamic";

transferScheduler.init();
autoTopupManager.init();

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const scheduled = searchParams.get("scheduled");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (scheduled === "true") where.is_scheduled = true;
  if (scheduled === "false") where.is_scheduled = false;

  const [transfers, total] = await Promise.all([
    prisma.transfer.findMany({
      where,
      include: {
        from_account: { include: { bank: { select: { bank_name: true } } } },
        to_account: { include: { bank: { select: { bank_name: true } } } },
      },
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transfer.count({ where }),
  ]);

  return NextResponse.json({
    data: transfers,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const {
    from_account_id,
    to_account_id,
    amount,
    concept,
    timestamp,
    is_scheduled,
    frequency,
    end_date,
  } = body;

  if (!from_account_id || !to_account_id || !amount || Number(amount) <= 0) {
    return NextResponse.json({ error: "from_account_id, to_account_id y amount (>0) son requeridos" }, { status: 400 });
  }

  if (from_account_id === to_account_id) {
    return NextResponse.json({ error: "La cuenta origen y destino deben ser diferentes" }, { status: 400 });
  }

  const numAmount = typeof amount === "number" ? amount : parseFloat(amount);
  const transferAmount = Math.abs(numAmount);

  const fromAccount = await prisma.account.findUnique({
    where: { id: from_account_id },
    include: { bank: true },
  });
  const toAccount = await prisma.account.findUnique({
    where: { id: to_account_id },
    include: { bank: true },
  });

  if (!fromAccount || !toAccount) {
    return NextResponse.json({ error: "Cuenta origen o destino no encontrada" }, { status: 404 });
  }

  const transferConcept = concept || `Transferencia a ${toAccount.account_label}`;
  const transferTimestamp = timestamp ? new Date(timestamp) : new Date();
  const now = new Date();

  const isFutureDate = transferTimestamp > now;
  const effectiveScheduled = is_scheduled || isFutureDate;

  let nextRun: Date | null = null;
  if (effectiveScheduled) {
    nextRun = transferTimestamp;
  }

  const transfer = await prisma.transfer.create({
    data: {
      from_account_id,
      to_account_id,
      amount: transferAmount,
      concept: transferConcept,
      timestamp: transferTimestamp,
      status: "pending",
      is_scheduled: effectiveScheduled,
      frequency: frequency || null,
      next_run: nextRun,
      end_date: end_date ? new Date(end_date) : null,
      enabled: true,
    },
    include: {
      from_account: { include: { bank: { select: { bank_name: true } } } },
      to_account: { include: { bank: { select: { bank_name: true } } } },
    },
  });

  // If not scheduled (immediate one-time), execute right away
  if (!effectiveScheduled) {
    await executeTransfer(transfer.id);
    const updated = await prisma.transfer.findUnique({
      where: { id: transfer.id },
      include: {
        from_account: { include: { bank: { select: { bank_name: true } } } },
        to_account: { include: { bank: { select: { bank_name: true } } } },
      },
    });
    return NextResponse.json(updated, { status: 201 });
  }

  // Register in scheduler
  transferScheduler.register(transfer.id);

  return NextResponse.json(transfer, { status: 201 });
}
