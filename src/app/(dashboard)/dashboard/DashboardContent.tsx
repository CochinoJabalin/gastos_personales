"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import DonutChart from "@/components/DonutChart";
import BarChart from "@/components/BarChart";
import ValueBlur from "@/components/ValueBlur";
import { t } from "@/lib/i18n";
import { useView } from "@/lib/ViewContext";
import { fmtEs } from "@/lib/format";

const DashboardGrid = dynamic(() => import("@/components/DashboardGrid"), { ssr: false });

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

interface InvestmentSummary {
  valor_total: number;
  total_invertido: number;
  tipo_allocation: Record<string, number>;
  holding_count: number;
}

interface InvestmentGoals {
  allocations: Record<string, number>;
}

interface BudgetCategoryConfig {
  necessities: string[];
  desires: string[];
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

interface DashboardInitialData {
  summary: DashboardSummary | null;
  matrix: MatrixResponse | null;
  banks: Bank[];
  investments: InvestmentSummary | null;
  investmentGoals: InvestmentGoals | null;
  budgetConfig: BudgetCategoryConfig;
  availableYears: number[];
  selectedYear: number;
}

export default function DashboardContent({ initialData }: { initialData: DashboardInitialData }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(initialData.summary);
  const [matrix, setMatrix] = useState<MatrixResponse | null>(initialData.matrix);
  const [banks, setBanks] = useState<Bank[]>(initialData.banks);
  const [investments, setInvestments] = useState<InvestmentSummary | null>(initialData.investments);
  const [investmentGoals, setInvestmentGoals] = useState<InvestmentGoals | null>(initialData.investmentGoals);
  const [budgetConfig, setBudgetConfig] = useState<BudgetCategoryConfig>(initialData.budgetConfig);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryModalType, setCategoryModalType] = useState<"necessities" | "desires">("necessities");
  const [tempSelectedCategories, setTempSelectedCategories] = useState<string[]>([]);
  const [savingBudgetConfig, setSavingBudgetConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const { hideValues, setHideValues } = useView();
  const [selectedYear, setSelectedYear] = useState(initialData.selectedYear);
  const [availableYears, setAvailableYears] = useState<number[]>(initialData.availableYears);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (initialData.availableYears.length === 0) {
      fetch("/api/transactions/years")
        .then((r) => r.json())
        .then((data) => {
          const years = (data.years || []) as number[];
          setAvailableYears(years);
        })
        .catch(() => {});
    }
  }, [initialData.availableYears]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/dashboard/summary?year=${selectedYear}`).then((r) => r.json()),
      fetch(`/api/dashboard/matrix?year=${selectedYear}`).then((r) => r.json()),
      fetch("/api/banks").then((r) => r.json()),
      fetch("/api/investments/summary").then((r) => r.json()).catch(() => null),
      fetch("/api/investments/goals").then((r) => r.json()).catch(() => null),
      fetch("/api/budget-categories").then((r) => r.json()).catch(() => ({ necessities: [], desires: [] })),
    ])
      .then(([s, m, b, inv, goals, budgetCfg]) => {
        setSummary(s);
        setMatrix(m);
        setBanks(b || []);
        setInvestments(inv);
        setInvestmentGoals(goals);
        setBudgetConfig(budgetCfg || { necessities: [], desires: [] });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedYear]);

  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [catMonthlyData, setCatMonthlyData] = useState<number[] | null>(null);
  const [catLoading, setCatLoading] = useState(false);

  function openCategoryDetail(group: string) {
    setSelectedCat(group);
    setCatLoading(true);
    setCatMonthlyData(null);
    Promise.all([
      fetch(`/api/dashboard/matrix?year=${selectedYear}`).then((r) => r.json()),
      fetch(`/api/dashboard/matrix?year=${selectedYear - 1}`).then((r) => r.json()),
    ])
      .then(([curr, prev]) => {
        const currGroups = curr.groupsMonthly?.filter(
          (gm: GroupMonthly) => gm.group === group
        ) || [];
        const prevGroups = prev.groupsMonthly?.filter(
          (gm: GroupMonthly) => gm.group === group
        ) || [];
        const combined: number[] = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date();
          d.setFullYear(d.getFullYear(), d.getMonth() - i, 1);
          const monthIndex = d.getMonth();
          const year = d.getFullYear();
          const source = year === selectedYear ? currGroups : prevGroups;
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
  const isCurrentYear = selectedYear === new Date().getFullYear();
  const monthsSoFar = isCurrentYear ? currentMonth + 1 : 12;

  const donutSegments = [
    { label: "Fijo", value: summary?.fixed_expenses || 0, color: "#adc6ff" },
    { label: "Variable", value: summary?.variable_expenses || 0, color: "#ffb786" },
    { label: "Ahorro", value: Math.max(summary?.net_savings || 0, 0), color: "#39485a" },
  ];
  const totalAssets = donutSegments.reduce((s, d) => s + d.value, 0);

  const barData = matrix
    ? matrix.months.slice(0, monthsSoFar).map((m) => ({
        label: monthLabels[m.month - 1],
        segments: [
          { value: m.income, color: "#adc6ff" },   // Ingreso (azul)
          { value: m.expenses, color: "#ffb786" }, // Gasto (naranja)
        ],
      }))
    : [];

  const netLine = matrix
    ? matrix.months.slice(0, monthsSoFar).map((m) => m.net)
    : [];

  const currMonthData = matrix?.months[currentMonth];
  const prevMonthData = currentMonth > 0 ? matrix?.months[currentMonth - 1] : null;

  const savingsRate = summary?.savings_rate || 0;
  const savingsPositive = savingsRate >= 15;
  const savingsCritical = savingsRate < 10;

  const totalExpensesYTD = matrix?.yearly.expenses || 0;

  const topCats = matrix?.groups
    ?.filter((g) => g.expenses > 0)
    .sort((a, b) => b.expenses - a.expenses)
    .slice(0, 5) || [];

  const maxCatExpense = topCats.length > 0 ? topCats[0].expenses : 1;

  const yearProgress = Math.round((monthsSoFar / 12) * 100);

  const totalBankBalance = banks.reduce((sum, b) => sum + b.balance, 0);

  const avgMonthlyExpense = monthsSoFar > 0 ? totalExpensesYTD / monthsSoFar : 0;

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
      <div className="flex items-center justify-end gap-sm">
        <button
          onClick={() => setEditMode(!editMode)}
          className={`flex items-center gap-xs px-sm py-1 rounded-lg text-label-caps text-[10px] uppercase transition-colors ${
            editMode
              ? "bg-primary text-primary-on"
              : "bg-surface-dim text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-sm">
            {editMode ? "check" : "tune"}
          </span>
          {editMode ? "Listo" : "Editar layout"}
        </button>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="bg-surface-dim text-on-surface-variant hover:text-on-surface rounded-lg px-sm py-1 text-label-caps text-[10px] uppercase border-0 focus:ring-1 focus:ring-primary cursor-pointer"
        >
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
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

      {/* Dashboard Grid */}
      <DashboardGrid
        editMode={editMode}
        widgetKeys={[
          "balance",
          "savings-rate",
          "annual-summary",
          "top-categories",
          "spend-velocity",
          "donut-chart",
          "bar-chart",
          "fixed-expense",
          "variable-expense",
          "projection",
          "financial-health",
          ...(investments && investments.holding_count > 0 ? ["investments"] : []),
        ]}
      >
        {/* Balance Total */}
        <section className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg min-h-0 h-full flex flex-col justify-between">
          <div className="flex flex-col gap-sm">
            <div className="flex items-center gap-sm">
              <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-lg text-on-primary-container">account_balance</span>
              </div>
              <p className="text-label-caps text-[9px] text-on-surface-variant uppercase">Balance Total</p>
            </div>
            <p className={`text-headline-md font-mono ${totalBankBalance >= 0 ? "text-positive" : "text-critical"}`}>
              <ValueBlur hidden={hideValues}>{fmtEs(totalBankBalance)}€</ValueBlur>
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
        <section className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg min-h-0 h-full flex flex-col justify-between">
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
              Neto: {summary ? `${fmtEs(summary?.net_savings || 0)}€` : ""}
            </span>
            </ValueBlur>
          </div>
        </section>

        {/* Resumen Anual */}
        <section className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg min-h-0 h-full flex flex-col justify-between">
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
                {fmtEs(matrix?.yearly.net || 0)}€
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
            <span className="text-label-caps text-[9px] text-on-surface-variant tabular-nums">{yearProgress}% del año</span>
            <div className="flex gap-md text-[9px] mt-1">
              <span className="text-on-surface-variant">Ingresos: <ValueBlur hidden={hideValues}><span className="text-positive tabular-nums val-euro">{fmtEs(matrix?.yearly.income || 0)}€</span></ValueBlur></span>
            </div>
            <div className="flex gap-md text-[9px]">
              <span className="text-on-surface-variant">Gastos: <ValueBlur hidden={hideValues}><span className="text-critical tabular-nums val-euro">{fmtEs(matrix?.yearly.expenses || 0)}€</span></ValueBlur></span>
            </div>
          </div>
        </section>

        {/* Top Categorías */}
        <section className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg h-full flex flex-col space-y-md overflow-auto">
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
                      {fmtEs(cat.expenses)}€
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

        {/* Velocidad de gasto */}
        <section className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg h-full flex flex-col space-y-md overflow-auto">
          <h3 className="text-label-caps text-on-surface-variant uppercase">
            Velocidad de Gasto
          </h3>
          <div className="flex flex-col gap-md flex-1 justify-center">
            <div>
              <span className="text-label-caps text-[9px] text-on-surface-variant uppercase">Gasto medio / día</span>
              <ValueBlur hidden={hideValues}>
              <span className="text-display-lg text-on-surface tabular-nums val-euro block">
                {currMonthData && monthsSoFar > 0 ? fmtEs(Math.round(currMonthData.expenses / new Date().getDate())) : 0}€
              </span>
              </ValueBlur>
            </div>
            <div className="h-px bg-[#2D3748]" />
            <div>
              <span className="text-label-caps text-[9px] text-on-surface-variant uppercase">Ingreso medio / día</span>
              <ValueBlur hidden={hideValues}>
              <span className="text-display-lg text-on-surface tabular-nums val-euro block">
                {currMonthData && monthsSoFar > 0 ? fmtEs(Math.round(currMonthData.income / new Date().getDate())) : 0}€
              </span>
              </ValueBlur>
            </div>
            <div className="h-px bg-[#2D3748]" />
            <div>
              <span className="text-label-caps text-[9px] text-on-surface-variant uppercase">Proyección anual gasto</span>
              <ValueBlur hidden={hideValues}>
              <span className="text-display-lg text-on-surface tabular-nums val-euro block">
                {currMonthData && monthsSoFar > 0 ? fmtEs(Math.round(avgMonthlyExpense * 12)) : 0}€
              </span>
              </ValueBlur>
            </div>
          </div>
        </section>

        {/* Donut Chart */}
        <section className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg h-full flex flex-col items-center justify-center space-y-md overflow-hidden">
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

        {/* Bar Chart */}
        <section className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg h-full flex flex-col overflow-hidden">
          <BarChart
            data={barData}
            trendLabel={t("dashboard.monthly_evolution")}
            trendValue={savingsPositive ? `${savingsRate.toFixed(1)}% ahorro` : `Gasto: ${fmtEs(currMonthData?.expenses || 0)}€`}
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
                <span className="w-2 h-2 rounded-sm bg-[#adc6ff]" />
                <span className="text-label-caps text-[9px] text-on-surface-variant">Ingresos</span>
              </div>
              <div className="flex items-center gap-xs">
                <span className="w-2 h-2 rounded-sm bg-[#ffb786]" />
                <span className="text-label-caps text-[9px] text-on-surface-variant">Gastos</span>
              </div>
              <div className="flex items-center gap-xs">
                <span className="w-1 h-2 bg-positive rounded-sm" />
                <span className="text-label-caps text-[9px] text-on-surface-variant">Neto</span>
              </div>
            </div>
          </div>
        </section>

        {/* Gasto Fijo */}
        <section className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg h-full flex flex-col space-y-md overflow-auto">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-label-caps text-on-surface-variant uppercase">
                {t("dashboard.fixed_expense")}
              </span>
              <ValueBlur hidden={hideValues}>
              <span className="text-display-lg text-on-surface tabular-nums val-euro">
                {fmtEs(currMonthData?.fixed || 0)}€
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
        <section className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg h-full flex flex-col space-y-md overflow-auto">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-label-caps text-on-surface-variant uppercase">
                {t("dashboard.variable_expense")}
              </span>
              <ValueBlur hidden={hideValues}>
              <span className="text-display-lg text-on-surface tabular-nums val-euro">
                {fmtEs(currMonthData?.variable || 0)}€
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
                {variableDelta > 0 ? "↑" : "↓"} {fmtEs(Math.abs(variableDelta))}€
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

        {/* Proyección Fin de Mes */}
        <section className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg h-full flex flex-col space-y-md overflow-auto">
          <div className="flex items-center gap-sm">
            <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-sm text-warning">schedule</span>
            </div>
            <h3 className="text-label-caps text-on-surface-variant uppercase">Proyección Fin de Mes</h3>
          </div>
          {(() => {
            const today = new Date();
            const dayOfMonth = today.getDate();
            const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
            const daysRemaining = daysInMonth - dayOfMonth;
            
            const currentVariable = currMonthData?.variable || 0;
            const dailyVariableRate = dayOfMonth > 0 ? currentVariable / dayOfMonth : 0;
            const projectedVariable = dailyVariableRate * daysInMonth;
            
            const currentFixed = currMonthData?.fixed || 0;
            const projectedExpenses = projectedVariable + currentFixed;
            const projectedIncome = currMonthData?.income || 0;
            const projectedNet = projectedIncome - projectedExpenses;
            const projectedSavingsRate = projectedIncome > 0 ? (projectedNet / projectedIncome) * 100 : 0;
            
            const avgSavingsRate = savingsRate;
            const savingsDiff = projectedSavingsRate - avgSavingsRate;
            
            const variableGroups = matrix?.groups?.filter(g => {
              const name = g.group.toLowerCase();
              return !name.includes('hipoteca') && !name.includes('comunidad') && 
                     !name.includes('servicios') && !name.includes('seguros') &&
                     !name.includes('nomina') && !name.includes('ingreso');
            }).sort((a, b) => b.expenses - a.expenses) || [];
            const topVariableGroup = variableGroups[0];
            
            return (
              <div className="flex flex-col gap-md flex-1">
                <div className="flex items-baseline gap-xs">
                  <ValueBlur hidden={hideValues}>
                    <span className={`text-headline-md font-mono ${projectedSavingsRate >= 15 ? "text-positive" : projectedSavingsRate >= 0 ? "text-warning" : "text-critical"}`}>
                      {projectedSavingsRate.toFixed(1)}%
                    </span>
                  </ValueBlur>
                  <span className="text-body-sm text-on-surface-variant">ahorro proyectado</span>
                </div>
                
                <div className="flex items-center gap-md text-body-sm">
                  <span className={savingsDiff >= 0 ? "text-positive" : "text-critical"}>
                    {savingsDiff >= 0 ? "↑" : "↓"} {Math.abs(savingsDiff).toFixed(1)}%
                  </span>
                  <span className="text-on-surface-variant">vs tu {avgSavingsRate.toFixed(0)}% habitual</span>
                </div>
                
                <div className="h-px bg-[#2D3748]" />
                
                <div className="flex flex-col gap-xs text-body-sm">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Gasto variable proyectado:</span>
                    <ValueBlur hidden={hideValues}>
                      <span className="text-on-surface tabular-nums">{fmtEs(Math.round(projectedVariable))}€</span>
                    </ValueBlur>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Días restantes:</span>
                    <span className="text-on-surface">{daysRemaining} días</span>
                  </div>
                </div>
                
                {topVariableGroup && savingsDiff < 0 && (
                  <div className="mt-auto p-sm bg-warning/5 border border-warning/20 rounded-lg">
                    <p className="text-body-sm text-warning">
                      💡 Modera el gasto en <strong>{stripPrefix(topVariableGroup.group)}</strong> esta semana
                    </p>
                  </div>
                )}
                
                {savingsDiff >= 5 && (
                  <div className="mt-auto p-sm bg-positive/5 border border-positive/20 rounded-lg">
                    <p className="text-body-sm text-positive">
                      🎉 ¡Vas muy bien! Superarás tu media de ahorro
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </section>

        {/* Salud Financiera */}
        <section className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg h-full flex flex-col space-y-md overflow-auto">
          <div className="flex items-center gap-sm">
            <div className="w-8 h-8 rounded-full bg-positive/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-sm text-positive">monitoring</span>
            </div>
            <h3 className="text-label-caps text-on-surface-variant uppercase">Salud Financiera</h3>
          </div>
          {(() => {
            const userNecessities = budgetConfig.necessities || [];
            const userDesires = budgetConfig.desires || [];
            const hasUserConfig = userNecessities.length > 0 || userDesires.length > 0;
            
            const necessityKeywords = ['hipoteca', 'comunidad', 'servicios', 'seguros', 'transporte', 'supermercado', 'salud', 'educación', 'luz', 'agua', 'gas', 'internet', 'telefon'];
            
            let necessities = 0;
            let desires = 0;
            
            matrix?.groups?.forEach(g => {
              if (g.expenses <= 0) return;
              
              if (hasUserConfig) {
                if (userNecessities.includes(g.group)) {
                  necessities += g.expenses;
                } else {
                  desires += g.expenses;
                }
              } else {
                const name = g.group.toLowerCase();
                if (necessityKeywords.some(k => name.includes(k))) {
                  necessities += g.expenses;
                } else {
                  desires += g.expenses;
                }
              }
            });
            
            const totalIncome = matrix?.yearly.income || 1;
            const totalSavings = Math.max((matrix?.yearly.net || 0), 0);
            
            const necessitiesPct = (necessities / totalIncome) * 100;
            const desiresPct = (desires / totalIncome) * 100;
            const savingsPct = (totalSavings / totalIncome) * 100;
            
            const necessitiesScore = Math.max(0, 100 - Math.abs(necessitiesPct - 50) * 2);
            const desiresScore = Math.max(0, 100 - Math.abs(desiresPct - 30) * 2);
            const savingsScore = savingsPct >= 20 ? 100 : (savingsPct / 20) * 100;
            const overallScore = Math.round((necessitiesScore * 0.3 + desiresScore * 0.3 + savingsScore * 0.4));
            
            const healthColor = overallScore >= 70 ? "#10B981" : overallScore >= 40 ? "#F59E0B" : "#EF4444";
            const healthLabel = overallScore >= 70 ? "Excelente" : overallScore >= 40 ? "Regular" : "Mejorable";
            
            const monthlyIncome = matrix?.averages?.income || 1;
            const fixedExpensesVal = matrix?.averages?.fixed || 0;
            const debtRatio = (fixedExpensesVal / monthlyIncome) * 100;
            const debtHealthy = debtRatio <= 35;
            
            const openCategoryModal = (type: "necessities" | "desires") => {
              setCategoryModalType(type);
              setTempSelectedCategories(type === "necessities" ? [...userNecessities] : [...userDesires]);
              setShowCategoryModal(true);
            };
            
            return (
              <div className="flex flex-col gap-md flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-sm">
                    <div className="relative w-12 h-12">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#2D3748" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="15.915"
                          fill="transparent"
                          stroke={healthColor}
                          strokeWidth="3"
                          strokeDasharray={`${overallScore} 100`}
                          strokeLinecap="round"
                          className="transition-all duration-700"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold tabular-nums" style={{ color: healthColor }}>{overallScore}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-headline-sm font-semibold" style={{ color: healthColor }}>{healthLabel}</p>
                      <p className="text-body-sm text-on-surface-variant">Score 50/30/20</p>
                    </div>
                  </div>
                  {savingsPct >= 20 && (
                    <div className="px-sm py-xs bg-positive/10 rounded-full">
                      <span className="text-positive text-body-sm font-medium">🏆 Ahorrador</span>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col gap-sm">
                  <div className="flex flex-col gap-xs">
                    <div className="flex justify-between text-body-sm">
                      <button 
                        onClick={() => openCategoryModal("necessities")}
                        className="text-on-surface-variant hover:text-primary hover:underline cursor-pointer transition-colors flex items-center gap-xs"
                      >
                        Necesidades (obj: 50%)
                        <span className="material-symbols-outlined text-xs opacity-50">edit</span>
                      </button>
                      <span className={necessitiesPct <= 55 ? "text-positive" : "text-warning"}>{necessitiesPct.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-surface-dim h-2 rounded-full overflow-hidden relative">
                      <div className="absolute left-1/2 w-px h-full bg-on-surface-variant/30" />
                      <div
                        className={`h-full rounded-full transition-all ${necessitiesPct <= 55 ? "bg-positive" : "bg-warning"}`}
                        style={{ width: `${Math.min(necessitiesPct, 100)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-xs">
                    <div className="flex justify-between text-body-sm">
                      <button 
                        onClick={() => openCategoryModal("desires")}
                        className="text-on-surface-variant hover:text-primary hover:underline cursor-pointer transition-colors flex items-center gap-xs"
                      >
                        Deseos (obj: 30%)
                        <span className="material-symbols-outlined text-xs opacity-50">edit</span>
                      </button>
                      <span className={desiresPct <= 35 ? "text-positive" : "text-warning"}>{desiresPct.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-surface-dim h-2 rounded-full overflow-hidden relative">
                      <div className="absolute left-[30%] w-px h-full bg-on-surface-variant/30" />
                      <div
                        className={`h-full rounded-full transition-all ${desiresPct <= 35 ? "bg-positive" : "bg-warning"}`}
                        style={{ width: `${Math.min(desiresPct, 100)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-xs">
                    <div className="flex justify-between text-body-sm">
                      <span className="text-on-surface-variant">Ahorro (obj: 20%)</span>
                      <span className={savingsPct >= 20 ? "text-positive" : "text-critical"}>{savingsPct.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-surface-dim h-2 rounded-full overflow-hidden relative">
                      <div className="absolute left-[20%] w-px h-full bg-on-surface-variant/30" />
                      <div
                        className={`h-full rounded-full transition-all ${savingsPct >= 20 ? "bg-positive" : "bg-critical"}`}
                        style={{ width: `${Math.min(savingsPct, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                {!hasUserConfig && (
                  <p className="text-body-sm text-on-surface-variant/60 italic">
                    Haz clic en Necesidades o Deseos para personalizar
                  </p>
                )}
                
                <div className="h-px bg-[#2D3748]" />
                
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-body-sm text-on-surface-variant">Capacidad de Endeudamiento</span>
                    <span className="text-body-sm text-on-surface-variant">(Gastos fijos / Ingresos)</span>
                  </div>
                  <div className="flex items-center gap-sm">
                    <span className={`text-headline-sm font-mono ${debtHealthy ? "text-positive" : "text-critical"}`}>
                      {debtRatio.toFixed(0)}%
                    </span>
                    <span className={`text-body-sm ${debtHealthy ? "text-positive" : "text-critical"}`}>
                      {debtHealthy ? "✓ OK" : "⚠ Alto"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </section>

        {/* Inversiones (condicional) */}
        {investments && investments.holding_count > 0 && (
          <section className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-lg h-full flex flex-col space-y-md overflow-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-sm">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm text-primary">pie_chart</span>
                </div>
                <h3 className="text-label-caps text-on-surface-variant uppercase">Diversificación y Rebalanceo</h3>
              </div>
              <a 
                href="/investments" 
                className="text-body-sm text-primary hover:underline flex items-center gap-xs"
              >
                Ver cartera
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </a>
            </div>
            
            {(() => {
              const allocation = investments.tipo_allocation || {};
              const totalValue = investments.valor_total || 0;
              const goals = investmentGoals?.allocations || {};
              
              const defaultGoals: Record<string, number> = {
                'ETF': 60,
                'Acciones': 30,
                'Bonos': 10,
              };
              
              const targetAllocation = Object.keys(goals).length > 0 ? goals : defaultGoals;
              
              const currentAllocation: Record<string, number> = {};
              Object.entries(allocation).forEach(([type, value]) => {
                currentAllocation[type] = totalValue > 0 ? (Number(value) / totalValue) * 100 : 0;
              });
              
              let needsRebalance = false;
              let rebalanceMessage = "";
              
              Object.entries(targetAllocation).forEach(([type, target]) => {
                const current = currentAllocation[type] || 0;
                const diff = Math.abs(current - target);
                if (diff > 5) {
                  needsRebalance = true;
                  if (current < target) {
                    rebalanceMessage = `Considera aumentar ${type} (${current.toFixed(0)}% → ${target}%)`;
                  } else {
                    rebalanceMessage = `Considera reducir ${type} (${current.toFixed(0)}% → ${target}%)`;
                  }
                }
              });
              
              const allTypes = [...new Set([...Object.keys(currentAllocation), ...Object.keys(targetAllocation)])];
              
              return (
                <div className="flex flex-col md:flex-row gap-lg">
                  <div className="flex-1">
                    <div className="flex flex-col gap-sm">
                      {allTypes.map(type => {
                        const current = currentAllocation[type] || 0;
                        const target = targetAllocation[type] || 0;
                        const value = allocation[type] || 0;
                        const diff = current - target;
                        const isAligned = Math.abs(diff) <= 5;
                        
                        return (
                          <div key={type} className="flex flex-col gap-xs">
                            <div className="flex justify-between text-body-sm">
                              <span className="text-on-surface">{type}</span>
                              <div className="flex items-center gap-md">
                                <ValueBlur hidden={hideValues}>
                                  <span className="text-on-surface-variant tabular-nums">{fmtEs(Number(value))}€</span>
                                </ValueBlur>
                                <span className={isAligned ? "text-positive" : "text-warning"}>
                                  {current.toFixed(0)}%
                                  {target > 0 && (
                                    <span className="text-on-surface-variant"> / {target}%</span>
                                  )}
                                </span>
                              </div>
                            </div>
                            <div className="w-full bg-surface-dim h-3 rounded-full overflow-hidden relative">
                              {target > 0 && (
                                <div 
                                  className="absolute h-full w-0.5 bg-on-surface-variant/50 z-10" 
                                  style={{ left: `${target}%` }}
                                />
                              )}
                              <div
                                className={`h-full rounded-full transition-all ${isAligned ? "bg-positive" : "bg-warning"}`}
                                style={{ width: `${Math.min(current, 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="md:w-64 flex flex-col gap-md">
                    <div className={`p-md rounded-lg border ${needsRebalance ? "bg-warning/5 border-warning/20" : "bg-positive/5 border-positive/20"}`}>
                      <div className="flex items-center gap-sm mb-sm">
                        <span className={`material-symbols-outlined text-lg ${needsRebalance ? "text-warning" : "text-positive"}`}>
                          {needsRebalance ? "warning" : "check_circle"}
                        </span>
                        <span className={`text-body-sm font-medium ${needsRebalance ? "text-warning" : "text-positive"}`}>
                          {needsRebalance ? "Rebalanceo sugerido" : "Cartera equilibrada"}
                        </span>
                      </div>
                      {needsRebalance && (
                        <p className="text-body-sm text-on-surface-variant">{rebalanceMessage}</p>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-xs text-body-sm">
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Valor total:</span>
                        <ValueBlur hidden={hideValues}>
                          <span className="text-on-surface font-medium tabular-nums">{fmtEs(totalValue)}€</span>
                        </ValueBlur>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Posiciones:</span>
                        <span className="text-on-surface">{investments.holding_count}</span>
                      </div>
                    </div>
                    
                    {Object.keys(goals).length === 0 && (
                      <p className="text-body-sm text-on-surface-variant italic">
                        Configura tus objetivos en Ajustes → Inversiones
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
          </section>
        )}
      </DashboardGrid>

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
                {catMonthlyData ? fmtEs(catMonthlyData.reduce((a, b) => a + b, 0)) : ""}€
              </span>
              </ValueBlur>
            </div>
          </div>
        </div>
      )}

      {/* Modal de selección de categorías para 50/30/20 */}
      {showCategoryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowCategoryModal(false)}
        >
          <div
            className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-lg">
              <h3 className="text-label-caps text-on-surface-variant uppercase">
                Seleccionar: {categoryModalType === "necessities" ? "Necesidades" : "Deseos"}
              </h3>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="p-1 rounded-lg hover:bg-[#2D3748] text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            
            <p className="text-body-sm text-on-surface-variant mb-md">
              {categoryModalType === "necessities" 
                ? "Selecciona las categorías que consideras gastos esenciales (hipoteca, servicios, seguros, etc.)"
                : "Selecciona las categorías que consideras gastos de ocio o no esenciales"
              }
            </p>
            
            <div className="flex-1 overflow-y-auto space-y-xs mb-lg">
              {(() => {
                const allGroups = matrix?.groups
                  ?.filter(g => g.expenses > 0)
                  .map(g => g.group)
                  .sort() || [];
                
                const otherType = categoryModalType === "necessities" ? "desires" : "necessities";
                const otherTypeCategories = otherType === "necessities" 
                  ? budgetConfig.necessities 
                  : budgetConfig.desires;
                
                return allGroups.map(group => {
                  const isSelected = tempSelectedCategories.includes(group);
                  const isInOtherType = otherTypeCategories.includes(group);
                  
                  return (
                    <label
                      key={group}
                      className={`flex items-center gap-md p-sm rounded-lg cursor-pointer transition-colors ${
                        isInOtherType 
                          ? "opacity-40 cursor-not-allowed" 
                          : isSelected 
                            ? "bg-primary/10" 
                            : "hover:bg-[#2D3748]/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isInOtherType}
                        onChange={() => {
                          if (isInOtherType) return;
                          setTempSelectedCategories(prev => 
                            prev.includes(group) 
                              ? prev.filter(c => c !== group)
                              : [...prev, group]
                          );
                        }}
                        className="w-4 h-4 rounded border-outline-variant bg-surface-container-high text-primary focus:ring-primary focus:ring-offset-0"
                      />
                      <span className={`text-body-sm flex-1 ${isInOtherType ? "line-through" : "text-on-surface"}`}>
                        {stripPrefix(group)}
                      </span>
                      {isInOtherType && (
                        <span className="text-body-sm text-on-surface-variant/60 italic">
                          (en {otherType === "necessities" ? "Necesidades" : "Deseos"})
                        </span>
                      )}
                    </label>
                  );
                });
              })()}
            </div>
            
            <div className="flex gap-md pt-md border-t border-[#2D3748]">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="flex-1 px-lg py-md rounded-lg text-body-sm font-medium border border-outline-variant text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setSavingBudgetConfig(true);
                  try {
                    const newConfig = {
                      ...budgetConfig,
                      [categoryModalType]: tempSelectedCategories,
                    };
                    const res = await fetch("/api/budget-categories", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(newConfig),
                    });
                    if (res.ok) {
                      const saved = await res.json();
                      setBudgetConfig(saved);
                    }
                  } finally {
                    setSavingBudgetConfig(false);
                    setShowCategoryModal(false);
                  }
                }}
                disabled={savingBudgetConfig}
                className="flex-1 px-lg py-md rounded-lg text-body-sm font-medium bg-primary text-primary-on hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {savingBudgetConfig ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
