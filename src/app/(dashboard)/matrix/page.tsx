"use client";

import { useEffect, useState } from "react";
import StatCard from "@/components/StatCard";
import ConditionalChip from "@/components/ConditionalChip";
import { formatSpanish } from "@/lib/format";

interface MatrixMonth {
  month: number;
  label: string;
  income: number;
  expenses: number;
  fixed: number;
  variable: number;
  net: number;
}

interface YearSummary {
  year: number;
  averages: { income: number; expenses: number; fixed: number; variable: number; net: number };
  yearly: { income: number; expenses: number; fixed: number; variable: number; net: number };
}

interface GroupMonthly {
  group: string;
  type: string;
  months: number[];
  total: number;
}

interface MatrixData {
  year: number;
  minYear: number;
  months: MatrixMonth[];
  averages: { income: number; expenses: number; fixed: number; variable: number; net: number };
  yearly: { income: number; expenses: number; fixed: number; variable: number; net: number };
  prevYear: YearSummary | null;
  groupsMonthly: GroupMonthly[];
}

interface DetailView {
  group: string;
  month: number;
  label: string;
  amount: number;
}

export default function MatrixPage() {
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<MatrixData | null>(null);
  const [detailType, setDetailType] = useState<"Fijo" | "Variable">("Variable");
  const [detail, setDetail] = useState<DetailView | null>(null);
  const [detailTxs, setDetailTxs] = useState<Array<{ id: string; concept: string; amount: number; timestamp: string; comentarios?: string | null; bank: { bank_name: string } | null }>>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [hideValues, setHideValues] = useState(false);

  useEffect(() => {
    fetch(`/api/dashboard/matrix?year=${year}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [year]);

  const months = data?.months || [];

  const totalRow = data?.yearly || {
    income: 0, expenses: 0, fixed: 0, variable: 0, net: 0,
  };

  const avgRow = data?.averages || {
    income: 0, expenses: 0, fixed: 0, variable: 0, net: 0,
  };

  const prevAverages = data?.prevYear?.averages || null;

  const MONTH_LABELS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  function openDetail(group: string, monthIdx: number, amount: number) {
    setDetail({ group, month: monthIdx + 1, label: MONTH_LABELS[monthIdx], amount });
    setDetailLoading(true);
    setDetailTxs([]);
    fetch(`/api/transactions?year=${year}&month=${monthIdx + 1}&group=${encodeURIComponent(group)}&type=${detailType}&limit=100`)
      .then(r => r.json())
      .then(data => setDetailTxs(data.data || []))
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }

  const noData = months.length === 0 || months.every(m => m.income === 0 && m.expenses === 0);

  const cifrasStyle = hideValues ? (
    <style>{`
      .hide-cifras .tabular-nums {
        filter: blur(6px);
        opacity: 0.35;
        user-select: none;
        pointer-events: none;
      }
    `}</style>
  ) : null;

  if (noData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 mb-4 bg-primary-container rounded-full flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl text-on-primary-container">
            table_chart
          </span>
        </div>
        <h2 className="text-headline-md text-on-surface mb-2">
          Sin datos este año
        </h2>
        <p className="text-body-md text-on-surface-variant mb-6 max-w-md">
          Añade transacciones para ver la matriz temporal con el desglose mensual.
        </p>
        <a
          href="/quick-entry"
          className="rounded-lg bg-primary px-6 py-3 text-body-md font-medium text-primary-on hover:bg-primary/90 transition-colors"
        >
          Añadir transacción
        </a>
      </div>
    );
  }

  return (
    <div className={`space-y-lg ${hideValues ? 'hide-cifras' : ''}`}>
      {cifrasStyle}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-sm">
        <div>
          <h2 className="text-display-lg text-on-surface">Matriz Temporal</h2>
          <p className="text-on-surface-variant text-body-sm">
            Análisis anual listo
          </p>
        </div>
        <div className="flex items-center gap-sm">
          <button
            onClick={() => setHideValues(!hideValues)}
            className="flex items-center gap-xs px-md py-sm rounded-lg bg-surface-container-low border border-outline-variant text-on-surface-variant hover:bg-surface-container-high transition-colors text-body-sm"
          >
            <span className="material-symbols-outlined text-lg">{hideValues ? "visibility" : "visibility_off"}</span>
            {hideValues ? "Mostrar" : "Ocultar"} cifras
          </button>
          <div className="flex items-center bg-surface-container-low rounded-xl border border-outline-variant">
            <button
              onClick={() => setYear(y => y - 1)}
              disabled={year <= (data?.minYear ?? year)}
              className="px-lg py-sm rounded-l-xl hover:bg-surface-container-high transition-colors text-on-surface-variant disabled:opacity-30"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <span className="px-lg py-sm text-label-caps text-on-surface font-semibold tabular-nums">
              {year}
            </span>
            <button
              onClick={() => setYear(y => y + 1)}
              disabled={year >= new Date().getFullYear()}
              className="px-lg py-sm rounded-r-xl hover:bg-surface-container-high transition-colors text-on-surface-variant disabled:opacity-30"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
          <div className="flex p-xs bg-surface-container-low rounded-xl border border-outline-variant">
            <button
              onClick={() => setViewMode("table")}
              className={`px-lg py-sm rounded-lg flex items-center gap-xs transition-all ${
                viewMode === "table"
                  ? "bg-secondary-container text-on-secondary-container font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">table_chart</span>
              <span className="text-label-caps">Tabla</span>
            </button>
            <button
              onClick={() => setViewMode("chart")}
              className={`px-lg py-sm rounded-lg flex items-center gap-xs transition-all ${
                viewMode === "chart"
                  ? "bg-secondary-container text-on-secondary-container font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">show_chart</span>
              <span className="text-label-caps">Gráfico</span>
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-gutter">
        <StatCard
          label="Ahorro Neto"
          value={`€${totalRow.net.toLocaleString("es")}`}
          trend="+12.4% vs periodo anterior"
          positive
        />
        <StatCard
          label="Tasa de Gasto"
          value={`€${totalRow.expenses.toLocaleString("es")}`}
          trend="Alerta Crítica"
          critical
        />
        <StatCard
          label="Eficiencia"
          value={`${data ? Math.round((totalRow.net / totalRow.income) * 100) : 0}%`}
          progress={data ? Math.round((totalRow.net / totalRow.income) * 100) : 0}
          progressColor="bg-primary"
        />
      </section>

      {viewMode === "table" ? (
        <section className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
          <div className="p-lg border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
            <h3 className="text-headline-md text-on-surface">Cuadrícula de Datos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high border-b border-outline-variant">
                  <th className="p-sm text-label-caps text-on-surface-variant sticky left-0 bg-surface-container-high z-10">
                    Categoría
                  </th>
                  {months.map((m) => (
                    <th key={m.month} className="p-sm text-label-caps text-on-surface-variant">
                      {m.label.substring(0, 3).toUpperCase()}
                    </th>
                  ))}
                  <th className="p-sm text-label-caps text-white">
                    Total
                  </th>
                  <th className="p-sm text-label-caps text-on-surface-variant">
                    Media
                  </th>
                  <th className="p-sm text-label-caps text-on-surface-variant bg-surface-container-highest">
                    Media Año Ant.
                  </th>
                </tr>
              </thead>
              <tbody className="text-data-mono text-body-sm">
                <tr className="border-b border-outline-variant hover:bg-surface-container-high transition-colors">
                  <td className="p-sm font-semibold text-on-surface sticky left-0 bg-surface-container z-10 border-r border-outline-variant">
                    Ingresos
                  </td>
                  {months.map((m) => (
                    <td key={m.month} className="p-sm text-primary tabular-nums">
                      €{m.income.toLocaleString("es")}
                    </td>
                  ))}
                  <td className="p-sm font-bold text-white tabular-nums">
                    €{totalRow.income.toLocaleString("es")}
                  </td>
                  <td className="p-sm font-bold tabular-nums">
                    €{avgRow.income.toLocaleString("es")}
                  </td>
                  <td className="p-sm font-bold tabular-nums bg-surface-container-highest">
                    €{prevAverages ? prevAverages.income.toLocaleString("es") : "-"}
                  </td>
                </tr>
                <tr className="border-b border-outline-variant hover:bg-surface-container-high transition-colors">
                  <td className="p-sm font-semibold text-on-surface sticky left-0 bg-surface-container z-10 border-r border-outline-variant">
                    Gastos Fijos
                  </td>
                  {months.map((m) => {
                    const isAlert = m.month >= 1 && m.month <= 4;
                    return (
                      <td
                        key={m.month}
                        className={`p-sm tabular-nums ${
                          isAlert ? "text-tertiary font-bold" : ""
                        }`}
                      >
                        €{m.fixed.toLocaleString("es")}
                      </td>
                    );
                  })}
                  <td className="p-sm font-bold text-white tabular-nums">
                    €{totalRow.fixed.toLocaleString("es")}
                  </td>
                  <td className="p-sm font-bold tabular-nums">
                    €{avgRow.fixed.toLocaleString("es")}
                  </td>
                  <td className="p-sm font-bold tabular-nums bg-surface-container-highest">
                    €{prevAverages ? prevAverages.fixed.toLocaleString("es") : "-"}
                  </td>
                </tr>
                <tr className="border-b border-outline-variant hover:bg-surface-container-high transition-colors">
                  <td className="p-sm font-semibold text-on-surface sticky left-0 bg-surface-container z-10 border-r border-outline-variant">
                    Gastos Variables
                  </td>
                  {months.map((m) => {
                    const isHigh = avgRow.variable > 0 && m.variable > (avgRow.variable * 1.5);
                    return (
                      <td
                        key={m.month}
                        className={`p-sm tabular-nums ${
                          isHigh ? "text-tertiary font-bold" : ""
                        }`}
                      >
                        €{m.variable.toLocaleString("es")}
                      </td>
                    );
                  })}
                  <td className="p-sm font-bold text-white tabular-nums">
                    €{totalRow.variable.toLocaleString("es")}
                  </td>
                  <td className="p-sm font-bold tabular-nums">
                    €{avgRow.variable.toLocaleString("es")}
                  </td>
                  <td className="p-sm font-bold tabular-nums bg-surface-container-highest">
                    €{prevAverages ? prevAverages.variable.toLocaleString("es") : "-"}
                  </td>
                </tr>
                <tr className="border-b border-outline-variant bg-surface-container-low font-bold">
                  <td className="p-sm text-on-surface sticky left-0 bg-surface-container-low z-10 border-r border-outline-variant">
                    Neto Mensual
                  </td>
                  {months.map((m) => (
                    <td
                      key={m.month}
                      className={`p-sm tabular-nums ${
                        m.net >= 0 ? "text-primary" : "text-tertiary"
                      }`}
                    >
                      €{m.net.toLocaleString("es")}
                    </td>
                  ))}
                  <td className="p-sm font-extrabold text-white tabular-nums">
                    €{totalRow.net.toLocaleString("es")}
                  </td>
                  <td className="p-sm font-extrabold tabular-nums">
                    €{avgRow.net.toLocaleString("es")}
                  </td>
                  <td className="p-sm font-extrabold tabular-nums bg-surface-container-highest">
                    €{prevAverages ? prevAverages.net.toLocaleString("es") : "-"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="bg-surface-container border border-outline-variant rounded-xl p-lg">
          <h3 className="text-headline-md text-on-surface mb-lg">
            Evolución Mensual
          </h3>
          <div className="h-64 flex gap-2">
            {months.map((m) => {
              const maxVal = Math.max(...months.map((x) => x.income), 1);
              const incomeH = (m.income / maxVal) * 100;
              const expenseH = (m.expenses / maxVal) * 100;
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 h-full">
                  <div className="flex-1 w-full flex flex-col justify-end">
                    <div
                      className="w-full bg-primary/60 rounded-t-sm transition-all"
                      style={{ height: `${incomeH}%` }}
                    />
                    <div
                      className="w-full bg-tertiary/60 rounded-t-sm transition-all"
                      style={{ height: `${expenseH}%` }}
                    />
                  </div>
                  <span className="text-label-caps text-[9px] text-on-surface-variant">
                    {m.label.substring(0, 3)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-lg mt-md">
            <div className="flex items-center gap-xs">
              <span className="w-3 h-3 rounded-sm bg-primary/60" />
              <span className="text-body-sm text-on-surface-variant">Ingresos</span>
            </div>
            <div className="flex items-center gap-xs">
              <span className="w-3 h-3 rounded-sm bg-tertiary/60" />
              <span className="text-body-sm text-on-surface-variant">Gastos</span>
            </div>
          </div>
        </section>
      )}

      <section className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
        <div className="p-lg border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
          <h3 className="text-headline-md text-on-surface">Desglose Mensual</h3>
          <div className="flex items-center bg-surface-container-high rounded-xl border border-outline-variant p-xs">
            <button
              onClick={() => setDetailType("Fijo")}
              className={`px-lg py-sm rounded-lg text-label-caps transition-all ${
                detailType === "Fijo"
                  ? "bg-secondary-container text-on-secondary-container font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              Gastos Fijos
            </button>
            <button
              onClick={() => setDetailType("Variable")}
              className={`px-lg py-sm rounded-lg text-label-caps transition-all ${
                detailType === "Variable"
                  ? "bg-secondary-container text-on-secondary-container font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              Gastos Variables
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high border-b border-outline-variant">
                <th className="p-sm text-label-caps text-on-surface-variant sticky left-0 bg-surface-container-high z-10">
                  Categoría
                </th>
                {months.map((m) => (
                  <th key={m.month} className="p-sm text-label-caps text-on-surface-variant">
                    {m.label.substring(0, 3).toUpperCase()}
                  </th>
                ))}
                <th className="p-sm text-label-caps text-white">
                  Total
                </th>
                <th className="p-sm text-label-caps text-on-surface-variant">
                  Media
                </th>
              </tr>
            </thead>
            <tbody className="text-data-mono text-body-sm">
              {data?.groupsMonthly
                .filter((g) => g.type === detailType)
                .map((g) => {
                  const avg = Math.round((g.total / 12) * 100) / 100;
                  return (
                    <tr key={g.group} className="border-b border-outline-variant hover:bg-surface-container-high transition-colors">
                      <td className="p-sm font-semibold text-on-surface sticky left-0 bg-surface-container z-10 border-r border-outline-variant">
                        {g.group}
                      </td>
                      {g.months.map((m, i) => (
                        <td
                          key={i}
                          className={`p-sm tabular-nums cursor-pointer transition-colors ${
                            m > 0
                              ? "hover:bg-primary-container/30 text-on-surface"
                              : "text-on-surface-variant/40"
                          }`}
                          onClick={() => m > 0 && openDetail(g.group, i, m)}
                        >
                          {m > 0 ? `€${m.toLocaleString("es")}` : "—"}
                        </td>
                      ))}
                      <td className="p-sm font-bold text-white tabular-nums">
                        €{g.total.toLocaleString("es")}
                      </td>
                      <td className="p-sm font-bold tabular-nums">
                        €{avg.toLocaleString("es")}
                      </td>
                    </tr>
                  );
                })}
              {(!data?.groupsMonthly || data.groupsMonthly.filter(g => g.type === detailType).length === 0) && (
                <tr>
                  <td colSpan={14 + 2} className="p-lg text-center text-on-surface-variant">
                    No hay categorías con {detailType === "Fijo" ? "gastos fijos" : "gastos variables"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {detail && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-16"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-surface-container border border-outline-variant rounded-xl w-full max-w-2xl mx-md max-h-[80vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-lg border-b border-outline-variant bg-surface-container-low">
              <div>
                <h3 className="text-headline-md text-on-surface">{detail.group}</h3>
                <p className="text-body-sm text-on-surface-variant">
                  {detail.label} {year} · {detailType}
                </p>
              </div>
              <div className="flex items-center gap-md">
                <span className="text-data-mono text-primary font-bold">€{formatSpanish(detail.amount)}</span>
                <button onClick={() => setDetail(null)} className="text-on-surface-variant hover:text-on-surface">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {detailLoading ? (
                <div className="p-lg text-center text-on-surface-variant">Cargando...</div>
              ) : detailTxs.length === 0 ? (
                <div className="p-lg text-center text-on-surface-variant">Sin transacciones</div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-high text-label-caps text-on-surface-variant">
                      <th className="p-sm">Concepto</th>
                      <th className="p-sm text-right">Importe</th>
                      <th className="p-sm">Fecha</th>
                      <th className="p-sm">Banco</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant text-body-sm">
                    {detailTxs.map(tx => (
                      <tr key={tx.id} className="hover:bg-surface-container-high transition-colors">
                        <td className="p-sm">
                          <div className="text-on-surface font-medium">{tx.concept}</div>
                          {tx.comentarios && (
                            <div className="text-on-surface-variant text-body-xs mt-xs">
                              {tx.comentarios}
                            </div>
                          )}
                        </td>
                        <td className={`p-sm text-right font-mono ${tx.amount < 0 ? "text-error" : "text-success"}`}>
                          {formatSpanish(Math.abs(tx.amount))}€
                        </td>
                        <td className="p-sm text-on-surface-variant">
                          {new Date(tx.timestamp).toLocaleDateString("es")}
                        </td>
                        <td className="p-sm text-on-surface-variant">
                          {tx.bank?.bank_name || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
