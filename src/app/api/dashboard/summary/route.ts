import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentYearStart = new Date(now.getFullYear(), 0, 1);

  const allTransactions = await prisma.transaction.findMany({
    where: {
      timestamp: { gte: currentYearStart },
    },
  });

  let totalIncome = 0;
  let totalExpenses = 0;
  let fixedExpenses = 0;
  let variableExpenses = 0;
  let currentMonthIncome = 0;
  let currentMonthExpenses = 0;

  for (const t of allTransactions) {
    const amount = Number(t.amount);
    if (amount > 0) {
      totalIncome += amount;
      if (t.timestamp >= currentMonthStart) currentMonthIncome += amount;
    } else {
      const absAmount = Math.abs(amount);
      totalExpenses += absAmount;
      if (t.timestamp >= currentMonthStart) currentMonthExpenses += absAmount;

      if (t.is_recurring && t.recurring_period === "anual") {
        const prorated = absAmount / 12;
        fixedExpenses += prorated;
      } else if (t.type === "Fijo") {
        fixedExpenses += t.is_recurring && t.recurring_period === "anual"
          ? absAmount / 12
          : absAmount;
      } else {
        variableExpenses += absAmount;
      }
    }
  }

  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  return NextResponse.json({
    total_income: totalIncome,
    total_expenses: totalExpenses,
    net_savings: netSavings,
    savings_rate: Math.round(savingsRate * 100) / 100,
    fixed_expenses: Math.round(fixedExpenses * 100) / 100,
    variable_expenses: Math.round(variableExpenses * 100) / 100,
    current_month_income: currentMonthIncome,
    current_month_expenses: currentMonthExpenses,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
}
