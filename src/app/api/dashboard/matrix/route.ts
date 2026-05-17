import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function calcMonthData(
  allTransactions: Array<{
    timestamp: Date; amount: number; is_recurring: boolean | null;
    recurring_period: string | null; type: string; group: string;
  }>
) {

  const months = Array.from({ length: 12 }, (_, i) => {
    const income = allTransactions
      .filter((t) => t.timestamp.getMonth() === i && Number(t.amount) > 0)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expenses = allTransactions
      .filter((t) => t.timestamp.getMonth() === i && Number(t.amount) < 0)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    const fixed = allTransactions
      .filter(
        (t) =>
          t.timestamp.getMonth() === i &&
          Number(t.amount) < 0 &&
          (t.is_recurring && t.recurring_period === "anual"
            ? true
            : t.type === "Fijo")
      )
      .reduce((sum, t) => {
        if (t.is_recurring && t.recurring_period === "anual") {
          return sum + Math.abs(Number(t.amount)) / 12;
        }
        return sum + Math.abs(Number(t.amount));
      }, 0);

    const variable = allTransactions
      .filter(
        (t) =>
          t.timestamp.getMonth() === i &&
          Number(t.amount) < 0 &&
          !(t.is_recurring && t.recurring_period === "anual") &&
          t.type !== "Fijo"
      )
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    return {
      month: i + 1,
      label: getMonthLabel(i),
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      fixed: Math.round(fixed * 100) / 100,
      variable: Math.round(variable * 100) / 100,
      net: Math.round((income - expenses) * 100) / 100,
    };
  });

  const yearlyIncome = months.reduce((sum, m) => sum + m.income, 0);
  const yearlyExpenses = months.reduce((sum, m) => sum + m.expenses, 0);

  const yearlyFixed = allTransactions
    .filter((t) => Number(t.amount) < 0)
    .reduce((sum, t) => {
      const base = Math.abs(Number(t.amount));
      if (t.is_recurring && t.recurring_period === "anual") {
        return sum + base / 12;
      }
      return t.type === "Fijo" ? sum + base : sum;
    }, 0);

  const yearlyVariable = allTransactions
    .filter((t) => Number(t.amount) < 0)
    .reduce((sum, t) => {
      const base = Math.abs(Number(t.amount));
      if (t.is_recurring && t.recurring_period === "anual") return sum;
      return t.type !== "Fijo" ? sum + base : sum;
    }, 0);

  return {
    months,
    yearly: {
      income: Math.round(yearlyIncome * 100) / 100,
      expenses: Math.round(yearlyExpenses * 100) / 100,
      fixed: Math.round(yearlyFixed * 100) / 100,
      variable: Math.round(yearlyVariable * 100) / 100,
      net: Math.round((yearlyIncome - yearlyExpenses) * 100) / 100,
    },
    averages: {
      income: Math.round((yearlyIncome / 12) * 100) / 100,
      expenses: Math.round((yearlyExpenses / 12) * 100) / 100,
      fixed: Math.round((yearlyFixed / 12) * 100) / 100,
      variable: Math.round((yearlyVariable / 12) * 100) / 100,
      net: Math.round(((yearlyIncome - yearlyExpenses) / 12) * 100) / 100,
    },
  };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || "") || new Date().getFullYear();
  const prevYear = year - 1;

  const [currentTxs, prevTxs, firstTx] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        timestamp: {
          gte: new Date(year, 0, 1),
          lt: new Date(year + 1, 0, 1),
        },
      },
    }),
    prisma.transaction.findMany({
      where: {
        timestamp: {
          gte: new Date(prevYear, 0, 1),
          lt: new Date(prevYear + 1, 0, 1),
        },
      },
    }),
    prisma.transaction.findFirst({ orderBy: { timestamp: "asc" }, select: { timestamp: true } }),
  ]);
  const minYear = firstTx ? firstTx.timestamp.getFullYear() : year;

  const current = calcMonthData(currentTxs as any);
  const prev = calcMonthData(prevTxs as any);

  const groups = await getGroupBreakdown(
    currentTxs.map((t) => ({ group: t.group, amount: Number(t.amount) }))
  );

  const groupsMonthly = getGroupsMonthly(currentTxs.map((t) => ({
    timestamp: t.timestamp,
    group: t.group,
    amount: Number(t.amount),
    type: t.type,
  })));

  return NextResponse.json({
    year,
    minYear,
    months: current.months,
    averages: current.averages,
    yearly: current.yearly,
    prevYear: {
      year: prevYear,
      averages: prev.averages,
      yearly: prev.yearly,
    },
    groups,
    groupsMonthly,
  });
}

function getMonthLabel(month: number): string {
  const labels = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  return labels[month];
}

function getGroupsMonthly(
  transactions: Array<{ timestamp: Date; group: string; amount: number; type: string }>
) {
  const map = new Map<string, { type: string; months: number[] }>();

  for (const t of transactions) {
    const amount = Number(t.amount);
    if (amount >= 0) continue;
    const month = t.timestamp.getMonth();
    const key = t.group;
    if (!map.has(key)) {
      const months = Array.from({ length: 12 }, () => 0);
      map.set(key, { type: t.type, months });
    }
    map.get(key)!.months[month] += Math.abs(amount);
  }

  return Array.from(map.entries())
    .map(([group, { type, months }]) => ({
      group,
      type,
      months: months.map(m => Math.round(m * 100) / 100),
      total: Math.round(months.reduce((a, b) => a + b, 0) * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total);
}

async function getGroupBreakdown(
  transactions: Array<{ group: string; amount: number }>
) {
  const groupMap: Record<string, { income: number; expenses: number }> = {};

  for (const t of transactions) {
    if (!groupMap[t.group]) {
      groupMap[t.group] = { income: 0, expenses: 0 };
    }
    const amount = Number(t.amount);
    if (amount > 0) {
      groupMap[t.group].income += amount;
    } else {
      groupMap[t.group].expenses += Math.abs(amount);
    }
  }

  return Object.entries(groupMap).map(([group, data]) => ({
    group,
    income: Math.round(data.income * 100) / 100,
    expenses: Math.round(data.expenses * 100) / 100,
    net: Math.round((data.income - data.expenses) * 100) / 100,
  }));
}
