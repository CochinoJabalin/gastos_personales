"use client";

import { useEffect, useState } from "react";
import DonutChart from "@/components/DonutChart";
import BarChart from "@/components/BarChart";
import ValueBlur from "@/components/ValueBlur";
import { t } from "@/lib/i18n";
import { useView } from "@/lib/ViewContext";

const stripPrefix = (s: string) => s.replace(/^gastos\s+/i, "");

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

interface GroupMonthly {
  group: string;
  type: string;
  months: number[];
  total: number;
}

interface Bank {
  id: string;
  bank_name: string;
  account_label: string;
  balance: number;
}

interface MatrixResponse {
  year: number;
  months: MonthData[];
  yearly: { income: number; expenses: number; fixed: number; variable: number; net: number };
  averages: { income: number; expenses: number; fixed: number; variable: number; net: number };
  groups: GroupData[];
  groupsMonthly: GroupMonthly[];
  prevYear: {
    year: number;
    averages: { income: number; expenses: number; fixed: number; variable: number; net: number };
    yearly: { income: number; expenses: number; fixed: number; variable: number; net: number };
  } | null;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [matrix, setMatrix] = useState<MatrixResponse | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const { hideValues, setHideValues } = useView();

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/summary").then((r) => r.json()),
      fetch("/api/dashboard/matrix").then((r) => r.json()),
      fetch("/api/banks").then((r) => r.json()),
    ])
      .then(([s, m, b]) => {
        setSummary(s);
        setMatrix(m);
        setBanks(b || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [catMonthlyData, setCatMonthlyData] = useState<number[] | null>(null);
  const [catLoading, setCatLoading] = useState(false);

  function openCategoryDetail(group: string) {
    setSelectedCat(group);
    setCatLoading(true);
    setCatMonthlyData(null);
    const currentYear = new Date().getFullYear();
    Promise.all([
      fetch(`/api/dashboard/matrix?year=${currentYear}`).then((r) => r.json()),
      fetch(`/api/dashboard/matrix?year=${currentYear - 1}`).then((r) => r.json()),
    ])
      .then(([curr, prev]) => {
        const currGroups = curr.groupsMonthly?.filter(
          (gm: GroupMonthly) => gm.group === group
        ) || [];
        const prevGroups = prev.groupsMonthly?.filter(
          (gm: GroupMonthly) => gm.group === group
        ) || [];
        const combined: number[] = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthIndex = d.getMonth();
          const year = d.getFullYear();
          const source = year === currentYear ? currGroups : prevGroups;
          const total = source.reduce((sum: number, g: GroupMonthly) => sum + (g.months[monthIndex] || 0), 0);
          combined.push(total);
        }
        setCatMonthlyData(combined);
      })
      .catch(() => {})
      .finally(() => setCatLoading(false));
  }

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
    { label: "Fijo", value: summary?.fixed_expenses || 0, color: "#adc6ff" },
    { label: "Variable", value: summary?.variable_expenses || 0, color: "#ffb786" },
    { label: "Ahorro", value: Math.max(summary?.net_savings || 0, 0), color: "#39485a" },
  ];
  const totalAssets = donutSegments.reduce((s, d) => s + d.value, 0);

  const barData = matrix
    ? matrix.months.slice(0, monthsSoFar).map((m) => ({
        label: monthLabels[m.month - 1],
        value: m.expenses,
      }))
    : [];

  const netLine = matrix
    ? matrix.months.slice(0, monthsSoFar).map((m) => m.net)
    : [];

  const currMonthData = matrix?.months[currentMonth];
  const prevMonthData = currentMonth > 0 ? matrix?.months[currentMonth - 1] : null;

  const incomeDelta = prevMonthData && currMonthData
    ? Math.round((currMonthData.income - prevMonthData.income) * 100) / 100
    : 0;
  const expenseDelta = prevMonthData && currMonthData
    ? Math.round((currMonthData.expenses - prevMonthData.expenses) * 100) / 100
    : 0;
  const netDelta = prevMonthData && currMonthData
    ? Math.round((currMonthData.net - prevMonthData.net) * 100) / 100
    : 0;

  const savingsRate = summary?.savings_rate || 0;
  const savingsPositive = savingsRate >= 15;
  const savingsCritical = savingsRate < 10;

  const totalExpensesYTD = matrix?.yearly.expenses || 0;

  const topCats = matrix?.groups
    ?.filter((g) => g.expenses > 0)
    .sort((a, b) => b.expenses - a.expenses)
    .slice(0, 5) || [];

  const maxCatExpense = topCats.length > 0 ? topCats[0].expenses : 1;

  const monthsAvailable = matrix?.months.filter((m) => m.income > 0 || m.expenses > 0).length || 1;
  const yearProgress = Math.round((monthsSoFar / 12) * 100);

  const totalBankBalance = banks.reduce((sum, b) => sum + b.balance, 0);

  const monthsWithData = matrix?.months.filter((m) => m.income > 0 || m.expenses > 0) || [];
  const positiveMonths = monthsWithData.filter((m) => m.net > 0).length;

  const netMonths = matrix?.months.map((m) => m.net) || [];
  const totalNet = netMonths.reduce((s, v) => s + v, 0);
  const avgNet = monthsAvailable > 0 ? totalNet / monthsAvailable : 0;
  const negMonths = netMonths.filter((v) => v < 0).length;

  const healthRaw = Math.max(0, Math.min(100, 50 + savingsRate * 2 - negMonths * 5));
  const healthScore = Math.round(healthRaw);
  const healthColor = healthScore >= 70 ? "#10B981" : healthScore >= 40 ? "#F59E0B" : "#EF4444";
  const healthLabel = healthScore >= 70 ? "Buena" : healthScore >= 40 ? "Regular" : "Crítica";

  const avgMonthlyExpense = monthsSoFar > 0 ? totalExpensesYTD / monthsSoFar : 0;
  const projectedOverspend = avgMonthlyExpense > 0
    ? Math.round((avgMonthlyExpense * 12 - (matrix?.yearly.income || 0)) * 100) / 100
    : 0;

  const avgMonthlyFixed = matrix?.averages?.fixed || 0;
  const avgMonthlyVariable = matrix?.averages?.variable || 0;

  const fixedPct = avgMonthlyFixed > 0
    ? Math.round(((currMonthData?.fixed || 0) / avgMonthlyFixed) * 100)
    : 0;
  const variablePct = avgMonthlyVariable > 0
    ? Math.round(((currMonthData?.variable || 0) / avgMonthlyVariable) * 100)
    : 0;

  const variableDelta = prevMonthData && currMonthData
    ? Math.round((currMonthData.variable - prevMonthData.variable) * 100) / 100
    : 0;

  return (
    <div className={`flex flex-col gap-6 ${hideValues ? "hide-cifras" : ""}`}>
      <div className="flex items-center justify-end">
        <button
          onClick={() => setHideValues(!hideValues)}
          className={`flex items-center gap-xs px-sm py-1 rounded-lg text-label-caps text-[10px] uppercase transition-colors ${
            hideValues
              ? "bg-primary text-primary-on"
              : "bg-surface-dim text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-sm">
            {hideValues ? "visibility_off" : "visibility"}
          </span>
          Ocultar cifras
        </button>
      </div>

      {/* Row 1: Balance Total + Tasa de Ahorro + Salud Financiera + vs Mes Anterior + Resumen Anual */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-gutter">
        {/* Balance Total */}
        <section className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg min-h-[180px] flex flex-col justify-between">
          <div className="flex flex-col gap-sm">
            <div className="flex items-center gap-sm">
              <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-lg text-on-primary-container">account_balance</span>
              </div>
              <p className="text-label-caps text-[9px] text-on-surface-variant uppercase">Balance Total</p>
            </div>
            <p className={`text-headline-md font-mono ${totalBankBalance >= 0 ? "text-positive" : "text-critical"}`}>
              <ValueBlur hidden={hideValues}>{totalBankBalance.toLocaleString("es")}€</ValueBlur>
            </p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-label-caps text-[9px] text-on-surface-variant">{banks.length} {banks.length === 1 ? "cuenta" : "cuentas"}</span>
            <a href="/settings/banks" className="text-label-caps text-[9px] text-primary hover:underline">
              Ver bancos
            </a>
          </div>
        </section>

        {/* Tasa de Ahorro */}
        <section className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg min-h-[180px] flex flex-col justify-between">
          <div className="flex flex-col gap-sm">
            <div className="flex items-center gap-sm">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${savingsPositive ? "bg-positive/10" : "bg-critical/10"}`}>
                <span className={`material-symbols-outlined text-sm ${savingsPositive ? "text-positive" : "text-critical"}`}>savings</span>
              </div>
              <p className="text-label-caps text-[9px] text-on-surface-variant uppercase">{t("dashboard.savings_rate")}</p>
            </div>
            <p className={`text-headline-sm font-mono ${savingsPositive ? "text-positive" : "text-critical"}`}>{savingsRate.toFixed(1)}%</p>
          </div>
          <div className="flex flex-col gap-xs">
            <div className="w-full bg-surface-dim h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${savingsPositive ? "bg-positive" : savingsCritical ? "bg-critical" : "bg-warning"}`}
                style={{ width: `${Math.min(savingsRate, 50) * 2}%` }}
              />
            </div>
            <ValueBlur hidden={hideValues}>
            <span className="text-label-caps text-[9px] text-on-surface-variant tabular-nums val-euro">
              Neto: {summary ? `${(summary?.net_savings || 0).toLocaleString("es")}€` : ""}
            </span>
            </ValueBlur>
          </div>
        </section>

        {/* Salud Financiera */}
        <section className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg min-h-[180px] flex flex-col justify-between">
          <div className="flex flex-col gap-sm">
            <div className="flex items-center gap-sm">
              <div className="relative w-8 h-8">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#2D3748" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.915"
                    fill="transparent"
                    stroke={healthColor}
                    strokeWidth="3"
                    strokeDasharray={`${(healthScore / 100) * 100} 100`}
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[8px] font-bold tabular-nums" style={{ color: healthColor }}>{healthScore}</span>
                  </div>
              </div>
              <p className="text-label-caps text-[9px] text-on-surface-variant uppercase">Salud Financiera</p>
            </div>
            <p className="text-body-sm font-semibold" style={{ color: healthColor }}>{healthLabel}</p>
          </div>
          <div className="flex flex-col gap-1 text-[9px]">
            <span className="text-on-surface-variant">{positiveMonths}/{monthsWithData.length} meses positivos</span>
            <span className="text-on-surface-variant">{savingsRate.toFixed(0)}% tasa de ahorro</span>
          </div>
        </section>

        {/* Comparativa mensual */}
        <section className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg min-h-[180px] flex flex-col justify-between">
          <p className="text-label-caps text-[9px] text-on-surface-variant uppercase">vs Mes Anterior</p>
          {prevMonthData && currMonthData ? (
            <div className="flex flex-col gap-sm mt-xs">
              <div className="flex items-center justify-between">
                <span className="text-[8px] text-on-surface-variant">Ingresos</span>
                <ValueBlur hidden={hideValues}>
                <span className={`text-label-caps tabular-nums val-euro ${incomeDelta >= 0 ? "text-positive" : "text-critical"}`}>
                  {incomeDelta >= 0 ? "+" : ""}{incomeDelta.toLocaleString("es")}€
                </span>
                </ValueBlur>
              </div>
              <div className="w-full h-px bg-[#2D3748]" />
              <div className="flex items-center justify-between">
                <span className="text-[8px] text-on-surface-variant">Gastos</span>
                <ValueBlur hidden={hideValues}>
                <span className={`text-label-caps tabular-nums val-euro ${expenseDelta <= 0 ? "text-positive" : "text-critical"}`}>
                  {expenseDelta > 0 ? "+" : ""}{expenseDelta.toLocaleString("es")}€
                </span>
                </ValueBlur>
              </div>
              <div className="w-full h-px bg-[#2D3748]" />
              <div className="flex items-center justify-between">
                <span className="text-[8px] text-on-surface-variant">Neto</span>
                <ValueBlur hidden={hideValues}>
                <span className={`text-label-caps tabular-nums val-euro font-bold ${netDelta >= 0 ? "text-positive" : "text-critical"}`}>
                  {netDelta >= 0 ? "+" : ""}{netDelta.toLocaleString("es")}€
                </span>
                </ValueBlur>
              </div>
            </div>
          ) : (
            <span className="text-[9px] text-on-surface-variant italic mt-xs">Sin datos</span>
          )}
        </section>

        {/* Resumen Anual */}
        <section className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg min-h-[180px] flex flex-col justify-between">
          <div className="flex flex-col gap-sm">
            <div className="flex items-center gap-sm">
              <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-sm text-on-secondary-container">calendar_month</span>
              </div>
              <p className="text-label-caps text-[9px] text-on-surface-variant uppercase">Resumen Anual</p>
            </div>
            <div className="flex items-baseline gap-xs">
              <ValueBlur hidden={hideValues}>
              <span className={`text-headline-sm font-mono val-euro ${(matrix?.yearly.net || 0) >= 0 ? "text-positive" : "text-critical"}`}>
                {(matrix?.yearly.net || 0).toLocaleString("es")}€
              </span>
              </ValueBlur>
              <span className="text-label-caps text-[9px] text-on-surface-variant">neto</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="w-full bg-surface-dim h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full rounded-full"
                style={{ width: `${yearProgress}%` }}
              />
            </div>
            <span className="text-label-caps text-[9px] text-on-surface-variant tabular-nums">{yearProgress}% del año</span>            <div className="flex gap-md text-[9px] mt-1">
              <span className="text-on-surface-variant">Ingresos: <ValueBlur hidden={hideValues}><span className="text-positive tabular-nums val-euro">{(matrix?.yearly.income || 0).toLocaleString("es")}€</span></ValueBlur></span>
            </div>
            <div className="flex gap-md text-[9px]">
              <span className="text-on-surface-variant">Gastos: <ValueBlur hidden={hideValues}><span className="text-critical tabular-nums val-euro">{(matrix?.yearly.expenses || 0).toLocaleString("es")}€</span></ValueBlur></span>
            </div>
          </div>
        </section>
      </div>

      {/* Row 2: Top categorías + velocidad de gasto */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
        {/* Top Categorías */}
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
                  <button
                    key={cat.group}
                    onClick={() => openCategoryDetail(cat.group)}
                    className="flex items-center gap-md w-full text-left hover:bg-[#2D3748]/50 rounded-lg px-1 -mx-1 py-1 transition-colors"
                  >
                    <span className="w-20 text-body-sm text-on-surface-variant truncate">
                      {stripPrefix(cat.group)}
                    </span>
                    <div className="flex-1 bg-surface-dim h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <ValueBlur hidden={hideValues}>
                    <span className="text-data-mono text-on-surface w-20 text-right tabular-nums val-euro">
                      {cat.expenses.toLocaleString("es")}€
                    </span>
                    </ValueBlur>
                    <span className="text-body-sm text-on-surface-variant w-10 text-right">
                      {pct.toFixed(0)}%
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Velocidad de gasto + Ingreso medio diario */}
        <section className="md:col-span-6 bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg flex flex-col space-y-md">
          <h3 className="text-label-caps text-on-surface-variant uppercase">
            Velocidad de Gasto
          </h3>
          <div className="flex flex-col gap-md flex-1 justify-center">
            <div>
              <span className="text-label-caps text-[9px] text-on-surface-variant uppercase">Gasto medio / día</span>
              <ValueBlur hidden={hideValues}>
              <span className="text-display-lg text-on-surface tabular-nums val-euro block">
                {currMonthData && monthsSoFar > 0 ? Math.round(currMonthData.expenses / new Date().getDate()).toLocaleString("es") : 0}€
              </span>
              </ValueBlur>
            </div>
            <div className="h-px bg-[#2D3748]" />
            <div>
              <span className="text-label-caps text-[9px] text-on-surface-variant uppercase">Ingreso medio / día</span>
              <ValueBlur hidden={hideValues}>
              <span className="text-display-lg text-on-surface tabular-nums val-euro block">
                {currMonthData && monthsSoFar > 0 ? Math.round(currMonthData.income / new Date().getDate()).toLocaleString("es") : 0}€
              </span>
              </ValueBlur>
            </div>
            <div className="h-px bg-[#2D3748]" />
            <div>
              <span className="text-label-caps text-[9px] text-on-surface-variant uppercase">Proyección anual gasto</span>
              <ValueBlur hidden={hideValues}>
              <span className="text-display-lg text-on-surface tabular-nums val-euro block">
                {currMonthData && monthsSoFar > 0 ? Math.round(avgMonthlyExpense * 12).toLocaleString("es") : 0}€
              </span>
              </ValueBlur>
            </div>
          </div>
        </section>
      </div>

      {/* Row 3: Donut + BarChart */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
        <section className="md:col-span-4 bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg flex flex-col items-center justify-center space-y-md">
          <h2 className="text-label-caps text-on-surface-variant w-full uppercase">
            {t("dashboard.total_assets")}
          </h2>
          <DonutChart
            segments={donutSegments}
            centerLabel={`${(totalAssets / 1000).toFixed(1)}K€`}
            centerSubtext={t("dashboard.overview")}
            size={192}
            showValues
            hidden={hideValues}
          />
        </section>

        <section className="md:col-span-8 bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg flex flex-col">
          <BarChart
            data={barData}
            trendLabel={t("dashboard.monthly_evolution")}
            trendValue={savingsPositive ? `${savingsRate.toFixed(1)}% ahorro` : `Gasto: ${(currMonthData?.expenses || 0).toLocaleString("es")}€`}
            trendPositive={savingsPositive}
            overlayLine={{
              values: netLine,
              color: "#10B981",
            }}
            hidden={hideValues}
          />
          <div className="flex items-center justify-between mt-sm">
            <div className="flex items-center gap-lg">
              <div className="flex items-center gap-xs">
                <span className="w-2 h-2 rounded-sm bg-[#ffb786]" />
                <span className="text-label-caps text-[9px] text-on-surface-variant">Gastos</span>
              </div>
              <div className="flex items-center gap-xs">
                <span className="w-2 h-2 rounded-sm bg-[#adc6ff]" />
                <span className="text-label-caps text-[9px] text-on-surface-variant">Ingresos</span>
              </div>
              <div className="flex items-center gap-xs">
                <span className="w-1 h-2 bg-positive rounded-sm" />
                <span className="text-label-caps text-[9px] text-on-surface-variant">Neto</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Row 4: Fixed/Variable */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
        {/* Gasto Fijo */}
        <section className="md:col-span-6 bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg flex flex-col space-y-md">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-label-caps text-on-surface-variant uppercase">
                {t("dashboard.fixed_expense")}
              </span>
              <ValueBlur hidden={hideValues}>
              <span className="text-display-lg text-on-surface tabular-nums val-euro">
                {(currMonthData?.fixed || 0).toLocaleString("es")}€
              </span>
              </ValueBlur>
            </div>
            <div className="p-md bg-secondary-container rounded-full text-on-secondary-container">
              <span className="material-symbols-outlined">lock</span>
            </div>
          </div>
          {avgMonthlyFixed > 0 && (
            <div className="text-body-sm text-on-surface-variant tabular-nums">
              {fixedPct <= 100 ? "↓" : "↑"} {Math.abs(fixedPct - 100).toFixed(0)}% vs media mensual
            </div>
          )}
          <div className="w-full bg-surface-dim h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full rounded-full"
              style={{ width: `${Math.min(fixedPct, 100)}%` }}
            />
          </div>
          <span className="text-label-caps text-[10px] text-on-surface-variant tabular-nums">
            {fixedPct.toFixed(0)}% del promedio mensual
          </span>
        </section>

        {/* Gasto Variable */}
        <section className="md:col-span-6 bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg flex flex-col space-y-md">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-label-caps text-on-surface-variant uppercase">
                {t("dashboard.variable_expense")}
              </span>
              <ValueBlur hidden={hideValues}>
              <span className="text-display-lg text-on-surface tabular-nums val-euro">
                {(currMonthData?.variable || 0).toLocaleString("es")}€
              </span>
              </ValueBlur>
            </div>
            <div className="p-md bg-tertiary-container rounded-full text-on-tertiary-container">
              <span className="material-symbols-outlined">trending_up</span>
            </div>
          </div>
          {prevMonthData && (
            <div className="text-body-sm tabular-nums val-euro">
              <ValueBlur hidden={hideValues}>
              <span className={variableDelta <= 0 ? "text-positive" : "text-critical"}>
                {variableDelta > 0 ? "↑" : "↓"} {Math.abs(variableDelta).toLocaleString("es")}€
              </span>
              </ValueBlur>
              <span className="text-on-surface-variant"> vs mes anterior</span>
            </div>
          )}
          <div className="w-full bg-surface-dim h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-tertiary h-full rounded-full"
              style={{ width: `${Math.min(variablePct, 100)}%` }}
            />
          </div>
          <span className="text-label-caps text-[10px] text-on-surface-variant tabular-nums">
            {variablePct.toFixed(0)}% del promedio mensual
          </span>
        </section>
      </div>

      {selectedCat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedCat(null)}
        >
          <div
            className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-lg">
              <h3 className="text-label-caps text-on-surface-variant uppercase">
                {stripPrefix(selectedCat)} — Últimos 12 Meses
              </h3>
              <button
                onClick={() => setSelectedCat(null)}
                className="p-1 rounded-lg hover:bg-[#2D3748] text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="h-48">
              {catLoading ? (
                <div className="flex items-center justify-center h-full text-on-surface-variant text-body-sm">Cargando...</div>
              ) : catMonthlyData ? (
                <BarChart
                  data={catMonthlyData.map((value, i) => {
                    const d = new Date();
                    d.setMonth(d.getMonth() - (11 - i));
                    return {
                      label: monthLabels[d.getMonth()],
                      value: Math.round(value * 100) / 100,
                      color: "#ffb786",
                    };
                  })}
                  hidden={hideValues}
                />
              ) : null}
            </div>
            <div className="flex items-center justify-between mt-md pt-md border-t border-[#2D3748]">
              <span className="text-body-sm text-on-surface-variant">Total 12 meses</span>
              <ValueBlur hidden={hideValues}>
              <span className="text-data-mono text-on-surface tabular-nums">
                {catMonthlyData ? catMonthlyData.reduce((a, b) => a + b, 0).toLocaleString("es") : ""}€
              </span>
              </ValueBlur>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
