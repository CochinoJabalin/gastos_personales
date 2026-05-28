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
  const completedLimit = parseInt(searchParams.get("limit") || searchParams.get("completed_limit") || "5");
  const scheduledLimit = parseInt(searchParams.get("scheduled_limit") || "5");
  const transferId = searchParams.get("transfer_id");
  const includeScheduled = searchParams.get("include_scheduled") !== "false"; // Default true

  // Calculate date range (last N months for completed, +3 months for scheduled)
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - months);

  const toDateScheduled = new Date();
  toDateScheduled.setMonth(toDateScheduled.getMonth() + 3);

  // Fetch completed executions (limited to completedLimit)
  let completedWhere: Record<string, unknown> = {
    status: { in: ["completed", "failed"] },
    executed_at: { gte: fromDate },
    amount: { not: 0 },
  };

  if (transferId) {
    completedWhere.transfer_id = transferId;
  }

  const completedExecutions = await prisma.transferExecution.findMany({
    where: completedWhere,
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
    take: completedLimit,
  });

  // Fetch scheduled executions (all of them for the next 3 months)
  let scheduledExecutions: typeof completedExecutions = [];
  
  if (includeScheduled) {
    let scheduledWhere: Record<string, unknown> = {
      status: "scheduled",
      scheduled_for: { lte: toDateScheduled },
      amount: { not: 0 },
    };

    if (transferId) {
      scheduledWhere.transfer_id = transferId;
    }

    scheduledExecutions = await prisma.transferExecution.findMany({
      where: scheduledWhere,
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
      orderBy: { scheduled_for: "asc" },
      take: scheduledLimit,
    });
  }

  // Combine and transform data for frontend
  const allExecutions = [...completedExecutions, ...scheduledExecutions];
  
  const data = allExecutions.map((exec) => ({
    id: exec.id,
    transfer_id: exec.transfer_id,
    executed_at: exec.executed_at.toISOString(),
    scheduled_for: exec.scheduled_for?.toISOString() || null,
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

  // Sort by effective date ascending (oldest first / nearest scheduled first)
  data.sort((a, b) => {
    const dateA = a.status === "scheduled" && a.scheduled_for ? new Date(a.scheduled_for) : new Date(a.executed_at);
    const dateB = b.status === "scheduled" && b.scheduled_for ? new Date(b.scheduled_for) : new Date(b.executed_at);
    return dateA.getTime() - dateB.getTime();
  });

  return NextResponse.json({
    data,
    total: data.length,
    from_date: fromDate.toISOString(),
  });
}
