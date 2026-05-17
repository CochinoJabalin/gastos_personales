"use client";

import { useEffect, useState } from "react";
import DonutChart from "@/components/DonutChart";
import BarChart from "@/components/BarChart";
import StatCard from "@/components/StatCard";
import { t } from "@/lib/i18n";

interface DashboardSummary {
  total_income: number;
  total_expenses: number;
  net_savings: number;
  savings_rate: number;
  fixed_expenses: number;
  variable_expenses: number;
  current_month_income: number;
  current_month_expenses: number;
}

interface MonthData {
  month: number;
  label: string;
  income: number;
  expenses: number;
  fixed: number;
  variable: number;
  net: number;
}

interface GroupData {
  group: string;
  income: number;
  expenses: number;
  net: number;
}

interface MatrixResponse {
  year: number;
  months: MonthData[];
  yearly: { income: number; expenses: number; fixed: number; variable: number; net: number };
  averages: { income: number; expenses: number; fixed: number; variable: number; net: number };
  groups: GroupData[];
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [matrix, setMatrix] = useState<MatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/summary").then((r) => r.json()),
      fetch("/api/dashboard/matrix").then((r) => r.json()),
    ])
      .then(([s, m]) => {
        setSummary(s);
        setMatrix(m);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-body-md text-on-surface-variant">Cargando...</div>
      </div>
    );
  }

  const noTransactions =
    !summary || (summary.total_income === 0 && summary.total_expenses === 0);

  if (noTransactions) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 mb-4 bg-primary-container rounded-full flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl text-on-primary-container">
            query_stats
          </span>
        </div>
        <h2 className="text-headline-md text-on-surface mb-2">
          Aún no hay transacciones
        </h2>
        <p className="text-body-md text-on-surface-variant mb-6 max-w-md">
          Empieza añadiendo tus primeros ingresos y gastos desde la sección de entrada rápida.
        </p>
        <a
          href="/quick-entry"
          className="rounded-lg bg-primary px-6 py-3 text-body-md font-medium text-primary-on hover:bg-primary/90 transition-colors"
        >
          Añadir primera transacción
        </a>
      </div>
    );
  }

  const monthLabels = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const currentMonth = new Date().getMonth();
  const monthsSoFar = currentMonth + 1;

  const donutSegments = [
    { label: "Fijo", value: summary?.fixed_expenses || 4250, color: "#adc6ff" },
    { label: "Variable", value: summary?.variable_expenses || 1890, color: "#ffb786" },
    { label: "Ahorro", value: Math.max(summary?.net_savings || 6000, 0), color: "#39485a" },
  ];
  const totalAssets = donutSegments.reduce((s, d) => s + d.value, 0);

  const barData = matrix
    ? matrix.months.slice(0, monthsSoFar).map((m) => ({
        label: monthLabels[m.month - 1],
        value: m.expenses,
      }))
    : [];

  const movingAvg = matrix
    ? matrix.months
        .slice(0, monthsSoFar)
        .map((_, i, arr) => {
          if (i < 2) return null;
          const avg = (arr[i - 2].expenses + arr[i - 1].expenses + arr[i].expenses) / 3;
          return Math.round(avg * 100) / 100;
        })
        .filter((v): v is number => v !== null)
    : [];

  const currMonthData = matrix?.months[currentMonth];
  const prevMonthData = currentMonth > 0 ? matrix?.months[currentMonth - 1] : null;

  const fixedChange =
    prevMonthData && prevMonthData.fixed > 0
      ? (((currMonthData?.fixed || 0) - prevMonthData.fixed) / prevMonthData.fixed) * 100
      : null;
  const variableChange =
    prevMonthData && prevMonthData.variable > 0
      ? (((currMonthData?.variable || 0) - prevMonthData.variable) / prevMonthData.variable) * 100
      : null;

  const savingsRate = summary?.savings_rate || 0;
  const savingsPositive = savingsRate >= 15;
  const savingsCritical = savingsRate < 10;

  const totalExpensesYTD = matrix?.yearly.expenses || 0;

  const topCats = matrix?.groups
    ?.filter((g) => g.expenses > 0)
    .sort((a, b) => b.expenses - a.expenses)
    .slice(0, 5) || [];

  const maxCatExpense = topCats.length > 0 ? topCats[0].expenses : 1;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
      {/* Row 1: StatCards */}
      <div className="md:col-span-3">
        <StatCard
          label={t("dashboard.income_month")}
          value={`€${(summary?.current_month_income || 0).toLocaleString("es")}`}
          icon="account_balance"
          iconBg="bg-primary-container"
        />
      </div>
      <div className="md:col-span-3">
        <StatCard
          label={t("dashboard.expenses_month")}
          value={`€${(summary?.current_month_expenses || 0).toLocaleString("es")}`}
          icon="shopping_cart"
          iconBg="bg-tertiary-container"
        />
      </div>
      <div className="md:col-span-3">
        <StatCard
          label={t("dashboard.savings_rate")}
          value={`${savingsRate.toFixed(1)}%`}
          trend={
            summary
              ? `€${(summary?.net_savings || 0).toLocaleString("es")} ${t("dashboard.net_savings").toLowerCase()}`
              : ""
          }
          positive={savingsPositive}
          critical={savingsCritical}
          icon="savings"
          iconBg={savingsPositive ? "bg-positive/10" : "bg-critical/10"}
        />
      </div>
      <div className="md:col-span-3">
        <StatCard
          label={t("dashboard.ytd_expenses")}
          value={`€${totalExpensesYTD.toLocaleString("es")}`}
          icon="receipt_long"
          iconBg="bg-secondary-container"
        />
      </div>

      {/* Row 2: Donut + BarChart real */}
      <section className="md:col-span-4 bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg flex flex-col items-center justify-center space-y-md">
        <h2 className="text-label-caps text-on-surface-variant w-full uppercase">
          {t("dashboard.total_assets")}
        </h2>
        <DonutChart
          segments={donutSegments}
          centerLabel={`€${(totalAssets / 1000).toFixed(1)}K`}
          centerSubtext={t("dashboard.overview")}
          size={192}
        />
      </section>

      <section className="md:col-span-8 bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg flex flex-col">
        <BarChart
          data={barData}
          trendLabel={t("dashboard.monthly_evolution")}
          trendValue={matrix ? `+${savingsRate.toFixed(1)}% ${t("dashboard.savings").toLowerCase()}` : ""}
          trendPositive={savingsPositive}
          trendLine={movingAvg.length > 1 ? movingAvg : undefined}
        />
        {movingAvg.length > 1 && (
          <div className="flex items-center gap-sm mt-sm">
            <span className="w-2 h-0.5 bg-positive rounded" />
            <span className="text-label-caps text-on-surface-variant text-[9px] uppercase">
              {t("dashboard.trend_3m")}
            </span>
          </div>
        )}
      </section>

      {/* Row 3: Fixed + Variable + Top Categories */}
      <section className="md:col-span-3 bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg flex flex-col space-y-md">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-label-caps text-on-surface-variant uppercase">
              {t("dashboard.fixed_expense")}
            </span>
            <span className="text-display-lg text-on-surface tabular-nums">
              €{(currMonthData?.fixed || 0).toLocaleString("es")}
            </span>
          </div>
          <div className="p-md bg-secondary-container rounded-full text-on-secondary-container">
            <span className="material-symbols-outlined">lock</span>
          </div>
        </div>
        <div className="w-full bg-surface-dim h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-primary h-full rounded-full"
            style={{
              width: `${Math.min(((currMonthData?.fixed || 0) / ((summary?.fixed_expenses || 6000) / monthsSoFar)) * 100, 100)}%`,
            }}
          />
        </div>
        {fixedChange !== null && (
          <span
            className={`text-data-mono text-body-sm tabular-nums ${
              fixedChange <= 0 ? "text-positive" : "text-critical"
            }`}
          >
            {fixedChange > 0 ? "+" : ""}
            {fixedChange.toFixed(1)}% {t("dashboard.vs_last_month")}
          </span>
        )}
      </section>

      <section className="md:col-span-3 bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg flex flex-col space-y-md">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-label-caps text-on-surface-variant uppercase">
              {t("dashboard.variable_expense")}
            </span>
            <span className="text-display-lg text-on-surface tabular-nums">
              €{(currMonthData?.variable || 0).toLocaleString("es")}
            </span>
          </div>
          <div className="p-md bg-tertiary-container rounded-full text-on-tertiary-container">
            <span className="material-symbols-outlined">trending_up</span>
          </div>
        </div>
        <div className="w-full bg-surface-dim h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-tertiary h-full rounded-full"
            style={{
              width: `${Math.min(((currMonthData?.variable || 0) / ((summary?.variable_expenses || 4000) / monthsSoFar)) * 100, 100)}%`,
            }}
          />
        </div>
        {variableChange !== null && (
          <span
            className={`text-data-mono text-body-sm tabular-nums ${
              variableChange <= 0 ? "text-positive" : "text-critical"
            }`}
          >
            {variableChange > 0 ? "+" : ""}
            {variableChange.toFixed(1)}% {t("dashboard.vs_last_month")}
          </span>
        )}
      </section>

      <section className="md:col-span-6 bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg flex flex-col space-y-md">
        <h3 className="text-label-caps text-on-surface-variant uppercase">
          {t("dashboard.top_categories")}
        </h3>
        {topCats.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant italic">
            Sin datos de categorías
          </p>
        ) : (
          <div className="flex flex-col gap-md">
            {topCats.map((cat) => {
              const pct = (cat.expenses / totalExpensesYTD) * 100;
              const barWidth = (cat.expenses / maxCatExpense) * 100;
              return (
                <div key={cat.group} className="flex items-center gap-md">
                  <span className="w-20 text-body-sm text-on-surface-variant truncate">
                    {cat.group}
                  </span>
                  <div className="flex-1 bg-surface-dim h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className="text-data-mono text-on-surface w-20 text-right tabular-nums">
                    €{cat.expenses.toLocaleString("es")}
                  </span>
                  <span className="text-body-sm text-on-surface-variant w-10 text-right">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
