"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import StatCard from "@/components/StatCard";

interface Account {
  id: string;
  account_label: string;
}

interface Payment {
  id: string;
  investment_id: string;
  fecha: string;
  importe: number;
  intereses: number;
  capital: number;
  created_transaction_id: string | null;
  comentarios: string | null;
  created_at: string;
}

interface Kpis {
  capital_pendiente: number;
  intereses_pendientes: number;
  total_retornado: number;
  total_esperado: number;
  intereses_cobrados: number;
  capital_devuelto: number;
}

interface Investment {
  id: string;
  account_id: string | null;
  account: Account | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  descripcion: string;
  meses_iniciales: number;
  meses_extension: number | null;
  cantidad: number;
  porcentaje_beneficio: number;
  roi: number | null;
  beneficios_brutos: number | null;
  impuestos: number | null;
  beneficios_netos: number | null;
  originador: string;
  tipo_shared: boolean;
  status: string;
  created_at: string;
  payments: Payment[];
  kpis: Kpis;
}

interface Summary {
  total_invertido: number;
  capital_pendiente: number;
  total_retornado: number;
  intereses_cobrados: number;
  beneficios_brutos: number;
  impuestos: number;
  beneficios_netos: number;
  roi_medio: number;
  num_inversiones: number;
  activas: number;
  finalizadas: number;
}

const ORIGINADORES = ["WECITY", "DOMOBLOCK", "URBANITAE"];

function formatEur(v: number) {
  return `${v.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es");
}

export default function CrowdlendingTab() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [originadorFilter, setOriginadorFilter] = useState("");

  const [showNewForm, setShowNewForm] = useState(false);
  const [detailInv, setDetailInv] = useState<Investment | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const [newForm, setNewForm] = useState({
    descripcion: "",
    originador: "URBANITAE",
    tipo_shared: false,
    fecha_inicio: new Date().toISOString().split("T")[0],
    meses_iniciales: "24",
    cantidad: "",
    porcentaje_beneficio: "",
    account_id: "",
  });

  const [paymentForm, setPaymentForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    importe: "",
    intereses: "",
    capital: "",
    comentarios: "",
  });

  function fetchAll() {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (originadorFilter) params.set("originador", originadorFilter);

    Promise.all([
      fetch(`/api/investments/crowdlending?${params}`).then((r) => r.json()),
      fetch("/api/investments/crowdlending/summary").then((r) => r.json()),
      fetch("/api/banks").then((r) => r.json()),
    ])
      .then(([invData, sumData, banksData]) => {
        setInvestments(invData);
        setSummary(sumData);
        const allAccounts: Account[] = [];
        for (const bank of banksData) {
          for (const acc of bank.accounts) {
            allAccounts.push({ id: acc.id, account_label: `${bank.bank_name} - ${acc.account_label}` });
          }
        }
        setAccounts(allAccounts);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, [statusFilter, originadorFilter]);

  async function createInvestment() {
    const body = {
      ...newForm,
      meses_iniciales: parseInt(newForm.meses_iniciales),
      cantidad: parseFloat(newForm.cantidad),
      porcentaje_beneficio: parseFloat(newForm.porcentaje_beneficio),
      account_id: newForm.account_id || null,
    };

    const res = await fetch("/api/investments/crowdlending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setShowNewForm(false);
      setNewForm({
        descripcion: "",
        originador: "URBANITAE",
        tipo_shared: false,
        fecha_inicio: new Date().toISOString().split("T")[0],
        meses_iniciales: "24",
        cantidad: "",
        porcentaje_beneficio: "",
        account_id: "",
      });
      fetchAll();
    }
  }

  async function createPayment() {
    if (!detailInv) return;
    const body = {
      fecha: paymentForm.fecha,
      importe: parseFloat(paymentForm.importe),
      intereses: parseFloat(paymentForm.intereses),
      capital: parseFloat(paymentForm.capital),
      comentarios: paymentForm.comentarios || null,
    };

    const res = await fetch(`/api/investments/crowdlending/${detailInv.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setShowPaymentForm(false);
      setPaymentForm({
        fecha: new Date().toISOString().split("T")[0],
        importe: "",
        intereses: "",
        capital: "",
        comentarios: "",
      });
      fetchAll();
      // Refresh detail
      const updated = await fetch(`/api/investments/crowdlending/${detailInv.id}`).then((r) => r.json());
      setDetailInv(updated);
    }
  }

  async function deleteInvestment(id: string) {
    if (!confirm(t("investments.crowdlending.confirm_delete_investment"))) return;
    await fetch(`/api/investments/crowdlending/${id}`, { method: "DELETE" });
    setDetailInv(null);
    fetchAll();
  }

  async function deletePayment(investmentId: string, paymentId: string) {
    if (!confirm(t("investments.crowdlending.confirm_delete_payment"))) return;
    await fetch(`/api/investments/crowdlending/${investmentId}/payments/${paymentId}`, {
      method: "DELETE",
    });
    const updated = await fetch(`/api/investments/crowdlending/${investmentId}`).then((r) => r.json());
    setDetailInv(updated);
    fetchAll();
  }

  async function markMatured(inv: Investment) {
    const body: Record<string, unknown> = { status: "MATURED" };
    if (inv.meses_extension) body.meses_extension = inv.meses_extension;
    await fetch(`/api/investments/crowdlending/${inv.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    fetchAll();
    if (detailInv?.id === inv.id) {
      const updated = await fetch(`/api/investments/crowdlending/${inv.id}`).then((r) => r.json());
      setDetailInv(updated);
    }
  }

  const statusColor: Record<string, string> = {
    ACTIVE: "text-positive",
    EXTENDED: "text-[#F59E0B]",
    MATURED: "text-on-surface-variant",
  };

  const statusLabel: Record<string, string> = {
    ACTIVE: t("investments.crowdlending.active"),
    EXTENDED: t("investments.crowdlending.extended"),
    MATURED: t("investments.crowdlending.matured"),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-xl">
        <span className="text-on-surface-variant">{t("quick_entry.description_hint")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-gutter">
          <StatCard label={t("investments.crowdlending.total_invested")} value={formatEur(summary.total_invertido)} icon="account_balance" iconBg="bg-[#1E3A5F]" />
          <StatCard label={t("investments.crowdlending.pending_capital")} value={formatEur(summary.capital_pendiente)} icon="hourglass_bottom" iconBg="bg-[#5F3A1E]" />
          <StatCard label={t("investments.crowdlending.total_returned")} value={formatEur(summary.total_retornado)} icon="payments" iconBg="bg-[#1E5F3A]" />
          <StatCard label={t("investments.crowdlending.collected_interest")} value={formatEur(summary.intereses_cobrados)} icon="trending_up" iconBg="bg-[#3A1E5F]" />
          <StatCard label={t("investments.crowdlending.net_profit")} value={formatEur(summary.beneficios_netos)} positive={summary.beneficios_netos > 0} icon="savings" iconBg="bg-[#1E5F5F]" />
          <StatCard label={t("investments.crowdlending.avg_roi")} value={`${summary.roi_medio.toFixed(1)}%`} positive={summary.roi_medio > 0} icon="percent" iconBg="bg-[#5F1E3A]" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-gutter">
        <div className="flex bg-surface-container border border-[#2D3748] rounded-lg p-xs">
          {["", "ACTIVE", "MATURED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-md py-sm rounded-md text-body-sm transition-colors ${
                statusFilter === s
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {s === "" ? t("investments.crowdlending.filters_all") : s === "ACTIVE" ? t("investments.crowdlending.filters_active") : t("investments.crowdlending.filters_matured")}
            </button>
          ))}
        </div>

        <select
          value={originadorFilter}
          onChange={(e) => setOriginadorFilter(e.target.value)}
          className="bg-surface-container border border-[#2D3748] rounded-lg px-md py-sm text-body-sm text-on-surface focus:outline-none focus:border-primary"
        >
          <option value="">{t("investments.crowdlending.originador_placeholder")}</option>
          {ORIGINADORES.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>

        <div className="flex-1" />

        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-xs bg-primary text-on-primary px-lg py-sm rounded-lg text-body-sm font-medium hover:brightness-110 transition-all"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          {t("investments.crowdlending.new_investment")}
        </button>
      </div>

      {/* Investments Table */}
      <div className="bg-surface-container border border-[#2D3748] rounded-xl overflow-hidden">
        {investments.length === 0 ? (
          <div className="p-xl text-center text-on-surface-variant text-body-md">
            {t("investments.crowdlending.no_investments")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-[#2D3748] text-label-caps text-on-surface-variant uppercase">
                  <th className="text-left p-md">{t("investments.crowdlending.description")}</th>
                  <th className="text-left p-md">{t("investments.crowdlending.originador")}</th>
                  <th className="text-left p-md">{t("investments.crowdlending.start_date")}</th>
                  <th className="text-right p-md">{t("investments.crowdlending.initial_term")}</th>
                  <th className="text-right p-md">{t("investments.crowdlending.amount")}</th>
                  <th className="text-right p-md">{t("investments.crowdlending.tae")}</th>
                  <th className="text-center p-md">{t("investments.crowdlending.status")}</th>
                  <th className="text-right p-md">{t("investments.crowdlending.pending_capital")}</th>
                  <th className="text-right p-md">{t("investments.crowdlending.roi")}</th>
                  <th className="text-center p-md">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {investments.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-[#2D3748] hover:bg-surface-dim/50 transition-colors cursor-pointer"
                    onClick={() => setDetailInv(inv)}
                  >
                    <td className="p-md font-medium text-on-surface">{inv.descripcion}</td>
                    <td className="p-md text-on-surface-variant">{inv.originador}</td>
                    <td className="p-md text-on-surface-variant">{formatDate(inv.fecha_inicio)}</td>
                    <td className="p-md text-right text-on-surface-variant">
                      {inv.meses_iniciales}{inv.meses_extension ? `+${inv.meses_extension}` : ""}m
                    </td>
                    <td className="p-md text-right tabular-nums text-on-surface">{formatEur(inv.cantidad)}</td>
                    <td className="p-md text-right tabular-nums text-on-surface">{inv.porcentaje_beneficio}%</td>
                    <td className="p-md text-center">
                      <span className={`text-label-caps ${statusColor[inv.status] || "text-on-surface-variant"}`}>
                        {statusLabel[inv.status] || inv.status}
                      </span>
                    </td>
                    <td className="p-md text-right tabular-nums text-on-surface-variant">
                      {inv.kpis ? formatEur(inv.kpis.capital_pendiente) : "-"}
                    </td>
                    <td className="p-md text-right tabular-nums text-on-surface">
                      {inv.roi !== null ? `${inv.roi.toFixed(1)}%` : "-"}
                    </td>
                    <td className="p-md text-center">
                      <div className="flex items-center justify-center gap-xs">
                        {inv.status !== "MATURED" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); markMatured(inv); }}
                            className="p-xs text-positive hover:bg-positive/10 rounded transition-colors"
                            title={t("investments.crowdlending.matured")}
                          >
                            <span className="material-symbols-outlined text-lg">check_circle</span>
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteInvestment(inv.id); }}
                          className="p-xs text-critical hover:bg-critical/10 rounded transition-colors"
                          title={t("investments.crowdlending.delete")}
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Investment Modal */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowNewForm(false)}>
          <div className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-xl w-full max-w-lg mx-md space-y-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-headline-md text-on-surface">{t("investments.crowdlending.new_investment")}</h2>
              <button onClick={() => setShowNewForm(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-md">
              <div>
                <label className="text-label-caps text-on-surface-variant uppercase block mb-xs">{t("investments.crowdlending.description")}</label>
                <input
                  value={newForm.descripcion}
                  onChange={(e) => setNewForm({ ...newForm, descripcion: e.target.value })}
                  className="w-full bg-surface-dim border border-[#2D3748] rounded-lg px-md py-sm text-body-md text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-gutter">
                <div>
                  <label className="text-label-caps text-on-surface-variant uppercase block mb-xs">{t("investments.crowdlending.originador")}</label>
                  <select
                    value={newForm.originador}
                    onChange={(e) => setNewForm({ ...newForm, originador: e.target.value })}
                    className="w-full bg-surface-dim border border-[#2D3748] rounded-lg px-md py-sm text-body-md text-on-surface focus:outline-none focus:border-primary"
                  >
                    {ORIGINADORES.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end pb-xs">
                  <label className="flex items-center gap-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newForm.tipo_shared}
                      onChange={(e) => setNewForm({ ...newForm, tipo_shared: e.target.checked })}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-body-sm text-on-surface-variant">{t("investments.crowdlending.shared")}</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-gutter">
                <div>
                  <label className="text-label-caps text-on-surface-variant uppercase block mb-xs">{t("investments.crowdlending.start_date")}</label>
                  <input
                    type="date"
                    value={newForm.fecha_inicio}
                    onChange={(e) => setNewForm({ ...newForm, fecha_inicio: e.target.value })}
                    className="w-full bg-surface-dim border border-[#2D3748] rounded-lg px-md py-sm text-body-md text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-label-caps text-on-surface-variant uppercase block mb-xs">{t("investments.crowdlending.initial_term")}</label>
                  <input
                    type="number"
                    value={newForm.meses_iniciales}
                    onChange={(e) => setNewForm({ ...newForm, meses_iniciales: e.target.value })}
                    className="w-full bg-surface-dim border border-[#2D3748] rounded-lg px-md py-sm text-body-md text-on-surface focus:outline-none focus:border-primary"
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-gutter">
                <div>
                  <label className="text-label-caps text-on-surface-variant uppercase block mb-xs">{t("investments.crowdlending.amount")}</label>
                  <input
                    type="number"
                    value={newForm.cantidad}
                    onChange={(e) => setNewForm({ ...newForm, cantidad: e.target.value })}
                    className="w-full bg-surface-dim border border-[#2D3748] rounded-lg px-md py-sm text-body-md text-on-surface focus:outline-none focus:border-primary"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="text-label-caps text-on-surface-variant uppercase block mb-xs">{t("investments.crowdlending.tae")}</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={newForm.porcentaje_beneficio}
                      onChange={(e) => setNewForm({ ...newForm, porcentaje_beneficio: e.target.value })}
                      className="w-full bg-surface-dim border border-[#2D3748] rounded-lg px-md py-sm text-body-md text-on-surface focus:outline-none focus:border-primary"
                      min="0"
                      step="0.1"
                    />
                    <span className="absolute right-md top-1/2 -translate-y-1/2 text-on-surface-variant text-body-sm">%</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-label-caps text-on-surface-variant uppercase block mb-xs">{t("quick_entry.bank_select")}</label>
                <select
                  value={newForm.account_id}
                  onChange={(e) => setNewForm({ ...newForm, account_id: e.target.value })}
                  className="w-full bg-surface-dim border border-[#2D3748] rounded-lg px-md py-sm text-body-md text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value="">Sin cuenta bancaria</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.account_label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-sm pt-sm">
              <button
                onClick={() => setShowNewForm(false)}
                className="px-lg py-sm rounded-lg text-body-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                {t("investments.crowdlending.cancel")}
              </button>
              <button
                onClick={createInvestment}
                className="px-lg py-sm rounded-lg text-body-sm bg-primary text-on-primary font-medium hover:brightness-110 transition-all"
              >
                {t("investments.crowdlending.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Investment Detail Modal */}
      {detailInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDetailInv(null)}>
          <div className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-xl w-full max-w-3xl mx-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-lg">
              <div>
                <h2 className="text-headline-md text-on-surface">{detailInv.descripcion}</h2>
                <p className="text-body-sm text-on-surface-variant">{detailInv.originador}</p>
              </div>
              <button onClick={() => setDetailInv(null)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Detail Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter mb-lg">
              <div className="bg-surface-dim rounded-lg p-md">
                <span className="text-label-caps text-on-surface-variant uppercase block">{t("investments.crowdlending.amount")}</span>
                <span className="text-data-mono text-on-surface">{formatEur(detailInv.cantidad)}</span>
              </div>
              <div className="bg-surface-dim rounded-lg p-md">
                <span className="text-label-caps text-on-surface-variant uppercase block">{t("investments.crowdlending.tae")}</span>
                <span className="text-data-mono text-on-surface">{detailInv.porcentaje_beneficio}%</span>
              </div>
              <div className="bg-surface-dim rounded-lg p-md">
                <span className="text-label-caps text-on-surface-variant uppercase block">{t("investments.crowdlending.start_date")}</span>
                <span className="text-data-mono text-on-surface">{formatDate(detailInv.fecha_inicio)}</span>
              </div>
              <div className="bg-surface-dim rounded-lg p-md">
                <span className="text-label-caps text-on-surface-variant uppercase block">{t("investments.crowdlending.status")}</span>
                <span className={`text-data-mono ${statusColor[detailInv.status] || "text-on-surface-variant"}`}>
                  {statusLabel[detailInv.status] || detailInv.status}
                </span>
              </div>
              <div className="bg-surface-dim rounded-lg p-md">
                <span className="text-label-caps text-on-surface-variant uppercase block">{t("investments.crowdlending.initial_term")}</span>
                <span className="text-data-mono text-on-surface">
                  {detailInv.meses_iniciales}{detailInv.meses_extension ? ` + ${detailInv.meses_extension}` : ""} {t("investments.crowdlending.months")}
                </span>
              </div>
              <div className="bg-surface-dim rounded-lg p-md">
                <span className="text-label-caps text-on-surface-variant uppercase block">{t("investments.crowdlending.pending_capital")}</span>
                <span className="text-data-mono text-on-surface">
                  {detailInv.kpis ? formatEur(detailInv.kpis.capital_pendiente) : "-"}
                </span>
              </div>
              <div className="bg-surface-dim rounded-lg p-md">
                <span className="text-label-caps text-on-surface-variant uppercase block">{t("investments.crowdlending.expected_total")}</span>
                <span className="text-data-mono text-on-surface">
                  {detailInv.kpis ? formatEur(detailInv.kpis.total_esperado) : "-"}
                </span>
              </div>
              <div className="bg-surface-dim rounded-lg p-md">
                <span className="text-label-caps text-on-surface-variant uppercase block">{t("investments.crowdlending.roi")}</span>
                <span className="text-data-mono text-positive">
                  {detailInv.roi !== null ? `${detailInv.roi.toFixed(2)}%` : "-"}
                </span>
              </div>
            </div>

            {/* Payments Section */}
            <div className="flex items-center justify-between mb-md">
              <h3 className="text-body-md font-semibold text-on-surface">{t("investments.crowdlending.payment_history")}</h3>
              {detailInv.status !== "MATURED" && (
                <button
                  onClick={() => setShowPaymentForm(true)}
                  className="flex items-center gap-xs bg-primary text-on-primary px-md py-sm rounded-lg text-body-sm font-medium hover:brightness-110 transition-all"
                >
                  <span className="material-symbols-outlined text-lg">add</span>
                  {t("investments.crowdlending.register_payment")}
                </button>
              )}
            </div>

            {detailInv.payments.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant py-md">{t("investments.crowdlending.no_payments")}</p>
            ) : (
              <div className="overflow-x-auto border border-[#2D3748] rounded-lg">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-[#2D3748] text-label-caps text-on-surface-variant uppercase">
                      <th className="text-left p-md">{t("investments.crowdlending.payment_date")}</th>
                      <th className="text-right p-md">{t("investments.crowdlending.total_amount")}</th>
                      <th className="text-right p-md">{t("investments.crowdlending.interest_part")}</th>
                      <th className="text-right p-md">{t("investments.crowdlending.capital_part")}</th>
                      <th className="text-left p-md">{t("quick_entry.description_hint")}</th>
                      <th className="text-center p-md">{t("investments.crowdlending.delete")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailInv.payments.map((p) => (
                      <tr key={p.id} className="border-b border-[#2D3748]">
                        <td className="p-md text-on-surface-variant">{formatDate(p.fecha)}</td>
                        <td className="p-md text-right tabular-nums text-on-surface">{formatEur(p.importe)}</td>
                        <td className="p-md text-right tabular-nums text-positive">{formatEur(p.intereses)}</td>
                        <td className="p-md text-right tabular-nums text-on-surface-variant">{formatEur(p.capital)}</td>
                        <td className="p-md text-on-surface-variant">{p.comentarios || "-"}</td>
                        <td className="p-md text-center">
                          <button
                            onClick={() => deletePayment(detailInv.id, p.id)}
                            className="p-xs text-critical hover:bg-critical/10 rounded transition-colors"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {detailInv.status !== "MATURED" && (
              <div className="flex justify-end mt-lg">
                <button
                  onClick={() => markMatured(detailInv)}
                  className="flex items-center gap-xs bg-positive/10 text-positive px-lg py-sm rounded-lg text-body-sm font-medium hover:bg-positive/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  Finalizar inversión
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Register Payment Modal */}
      {showPaymentForm && detailInv && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowPaymentForm(false)}>
          <div className="bg-[#1A222F] border border-[#2D3748] rounded-xl p-xl w-full max-w-md mx-md space-y-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-headline-md text-on-surface">{t("investments.crowdlending.register_payment")}</h2>
              <button onClick={() => setShowPaymentForm(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-md">
              <div>
                <label className="text-label-caps text-on-surface-variant uppercase block mb-xs">{t("investments.crowdlending.payment_date")}</label>
                <input
                  type="date"
                  value={paymentForm.fecha}
                  onChange={(e) => setPaymentForm({ ...paymentForm, fecha: e.target.value })}
                  className="w-full bg-surface-dim border border-[#2D3748] rounded-lg px-md py-sm text-body-md text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-label-caps text-on-surface-variant uppercase block mb-xs">{t("investments.crowdlending.total_amount")}</label>
                <div className="relative">
                  <input
                    type="number"
                    value={paymentForm.importe}
                    onChange={(e) => setPaymentForm({ ...paymentForm, importe: e.target.value })}
                    className="w-full bg-surface-dim border border-[#2D3748] rounded-lg px-md py-sm text-body-md text-on-surface focus:outline-none focus:border-primary"
                    min="0"
                    step="0.01"
                  />
                  <span className="absolute right-md top-1/2 -translate-y-1/2 text-on-surface-variant text-body-sm">€</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-gutter">
                <div>
                  <label className="text-label-caps text-on-surface-variant uppercase block mb-xs">{t("investments.crowdlending.interest_part")}</label>
                  <input
                    type="number"
                    value={paymentForm.intereses}
                    onChange={(e) => setPaymentForm({ ...paymentForm, intereses: e.target.value })}
                    className="w-full bg-surface-dim border border-[#2D3748] rounded-lg px-md py-sm text-body-md text-on-surface focus:outline-none focus:border-primary"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="text-label-caps text-on-surface-variant uppercase block mb-xs">{t("investments.crowdlending.capital_part")}</label>
                  <input
                    type="number"
                    value={paymentForm.capital}
                    onChange={(e) => setPaymentForm({ ...paymentForm, capital: e.target.value })}
                    className="w-full bg-surface-dim border border-[#2D3748] rounded-lg px-md py-sm text-body-md text-on-surface focus:outline-none focus:border-primary"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="text-label-caps text-on-surface-variant uppercase block mb-xs">{t("investments.crowdlending.description")}</label>
                <input
                  value={paymentForm.comentarios}
                  onChange={(e) => setPaymentForm({ ...paymentForm, comentarios: e.target.value })}
                  className="w-full bg-surface-dim border border-[#2D3748] rounded-lg px-md py-sm text-body-md text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-sm pt-sm">
              <button
                onClick={() => setShowPaymentForm(false)}
                className="px-lg py-sm rounded-lg text-body-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                {t("investments.crowdlending.cancel")}
              </button>
              <button
                onClick={createPayment}
                className="px-lg py-sm rounded-lg text-body-sm bg-primary text-on-primary font-medium hover:brightness-110 transition-all"
              >
                {t("investments.crowdlending.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
