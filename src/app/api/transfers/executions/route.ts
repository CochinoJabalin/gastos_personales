import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const months = parseInt(searchParams.get("months") || "2");
  const limit = parseInt(searchParams.get("limit") || "100");
  const transferId = searchParams.get("transfer_id");

  // Calculate date range (last N months)
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - months);

  const where: Record<string, unknown> = {
    executed_at: { gte: fromDate },
  };

  if (transferId) {
    where.transfer_id = transferId;
  }

  const executions = await prisma.transferExecution.findMany({
    where,
    include: {
      transfer: {
        include: {
          from_account: {
            include: {
              bank: { select: { bank_name: true } },
            },
          },
          to_account: {
            include: {
              bank: { select: { bank_name: true } },
            },
          },
        },
      },
    },
    orderBy: { executed_at: "desc" },
    take: limit,
  });

  // Transform data for frontend
  const data = executions.map((exec) => ({
    id: exec.id,
    transfer_id: exec.transfer_id,
    executed_at: exec.executed_at.toISOString(),
    amount: Number(exec.amount),
    from_balance_before: Number(exec.from_balance_before),
    from_balance_after: Number(exec.from_balance_after),
    to_balance_before: Number(exec.to_balance_before),
    to_balance_after: Number(exec.to_balance_after),
    status: exec.status,
    error_message: exec.error_message,
    // Transfer details
    from_account: {
      id: exec.transfer.from_account_id,
      account_label: exec.transfer.from_account.account_label,
      bank_name: exec.transfer.from_account.bank.bank_name,
    },
    to_account: {
      id: exec.transfer.to_account_id,
      account_label: exec.transfer.to_account.account_label,
      bank_name: exec.transfer.to_account.bank.bank_name,
    },
    concept: exec.transfer.concept,
    is_interest_payment: exec.transfer.from_account_id === exec.transfer.to_account_id,
    is_scheduled: exec.transfer.is_scheduled,
    frequency: exec.transfer.frequency,
  }));

  return NextResponse.json({
    data,
    total: data.length,
    from_date: fromDate.toISOString(),
  });
}
