"use client";

import { useState, useEffect } from "react";
import { t } from "@/lib/i18n";
import CrowdlendingTab from "@/components/CrowdlendingTab";

type Tab = "portfolio" | "holdings" | "dividends" | "operations" | "crowdlending";

export default function InvestmentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("portfolio");

  const tabs: { key: Tab; label: string }[] = [
    { key: "portfolio", label: t("investments.portfolio") },
    { key: "holdings", label: t("investments.holdings") },
    { key: "dividends", label: t("investments.dividends") },
    { key: "operations", label: t("investments.operations") },
    { key: "crowdlending", label: "Crowdlending" },
  ];

  return (
    <div className="space-y-lg">
      <div className="flex gap-2 border-b border-outline-variant pb-lg">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-lg py-md rounded-lg text-body-sm transition-colors ${
              activeTab === tab.key
                ? "bg-primary/10 text-primary"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "portfolio" && <PortfolioTab />}
      {activeTab === "holdings" && <HoldingsTab />}
      {activeTab === "dividends" && <DividendsTab />}
      {activeTab === "operations" && <OperationsTab />}
      {activeTab === "crowdlending" && <CrowdlendingTab />}
    </div>
  );
}

function StatCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  const color = positive !== undefined ? (positive ? "text-positive" : "text-critical") : "text-on-surface";
  return (
    <section className="bg-surface-container border border-outline-variant p-lg rounded-xl flex flex-col gap-md">
      <span className="text-label-caps text-on-surface-variant uppercase">{label}</span>
      <div>
        <h2 className={`text-headline-md ${color}`}>{value}</h2>
        {sub && <span className="text-body-sm text-on-surface-variant">{sub}</span>}
      </div>
    </section>
  );
}

function PortfolioTab() {
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    fetch("/api/investments/summary")
      .then((r) => r.json())
      .then(setSummary);
  }, []);

  if (!summary) return <div className="text-body-sm text-on-surface-variant">Cargando...</div>;

  return (
    <div className="space-y-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
        <StatCard label={t("investments.total_value")} value={`${summary.valor_total.toLocaleString("es")} €`} />
        <StatCard label={t("investments.total_invested")} value={`${summary.total_invertido.toLocaleString("es")} €`} />
        <StatCard label={t("investments.total_return")} value={`${summary.rentabilidad_total.toFixed(2)}%`} positive={summary.rentabilidad_total >= 0} />
        <StatCard label={t("investments.unrealized_gains")} value={`${summary.plusvalias_no_realizadas.toLocaleString("es")} €`} positive={summary.plusvalias_no_realizadas >= 0} />
        <StatCard label={t("investments.annual_dividends")} value={`${summary.dividendos_anuales.toLocaleString("es")} €`} />
        <StatCard label={t("investments.dividend_yield")} value={`${summary.dividend_yield.toFixed(2)}%`} />
        <StatCard label={t("investments.realized_return")} value={`${summary.plusvalias_realizadas.toLocaleString("es")} €`} positive={summary.plusvalias_realizadas >= 0} />
      </div>

      <section className="bg-surface-container border border-outline-variant p-lg rounded-xl">
        <h3 className="text-body-md font-semibold text-on-surface mb-md">{t("investments.type")}</h3>
        <div className="space-y-sm">
          {Object.entries(summary.tipo_allocation || {}).map(([tipo, valor]) => (
            <div key={tipo} className="flex justify-between text-body-sm">
              <span className="text-on-surface-variant">{tipo}</span>
              <span className="text-on-surface">{Number(valor).toLocaleString("es")} €</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface-container border border-outline-variant p-lg rounded-xl overflow-x-auto">
        <h3 className="text-body-md font-semibold text-on-surface mb-md">{t("investments.holdings")}</h3>
        <table className="w-full text-body-sm">
          <thead>
            <tr className="text-label-caps text-on-surface-variant">
              <th className="text-left py-sm pr-md">{t("investments.ticker")}</th>
              <th className="text-left py-sm pr-md">{t("investments.name")}</th>
              <th className="text-right py-sm pr-md">{t("investments.value")}</th>
              <th className="text-right py-sm">{t("investments.weight")}</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(summary.instrument_allocation || {}).map((item: any) => (
              <tr key={item.ticker} className="border-t border-outline-variant/50">
                <td className="py-sm pr-md font-mono">{item.ticker}</td>
                <td className="py-sm pr-md text-on-surface-variant">{item.name}</td>
                <td className="py-sm pr-md text-right font-mono">{item.valor.toLocaleString("es")} €</td>
                <td className="py-sm text-right text-on-surface-variant">{item.peso.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function HoldingsTab() {
  const [holdings, setHoldings] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchHoldings = () => {
    fetch("/api/investments/holdings")
      .then((r) => r.json())
      .then(setHoldings);
  };

  useEffect(() => { fetchHoldings(); }, []);

  const updatePrices = async () => {
    setUpdating(true);
    await fetch("/api/investments/update-prices", { method: "POST" });
    await fetchHoldings();
    setUpdating(false);
  };

  if (holdings.length === 0) {
    return (
      <div className="text-center py-xl text-body-sm text-on-surface-variant">
        {t("investments.no_holdings")}
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      <div className="flex justify-end">
        <button
          onClick={updatePrices}
          disabled={updating}
          className="bg-primary text-on-primary px-lg py-md rounded-lg text-body-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {updating ? "Actualizando..." : t("investments.update_prices")}
        </button>
      </div>

      <section className="bg-surface-container border border-outline-variant rounded-xl overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="text-label-caps text-on-surface-variant border-b border-outline-variant">
              <th className="text-left py-sm px-md">{t("investments.ticker")}</th>
              <th className="text-left py-sm pr-md">{t("investments.name")}</th>
              <th className="text-right py-sm pr-md">{t("investments.quantity")}</th>
              <th className="text-right py-sm pr-md">{t("investments.avg_price")}</th>
              <th className="text-right py-sm pr-md">{t("investments.current_price")}</th>
              <th className="text-right py-sm pr-md">{t("investments.value")}</th>
              <th className="text-right py-sm pr-md">{t("investments.profit_loss")}</th>
              <th className="text-right py-sm pr-md">ROI</th>
              <th className="text-right py-sm">{t("investments.last_updated")}</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h: any) => {
              const isExpanded = expanded === h.id;
              return (
                <>
                  <tr
                    key={h.id}
                    onClick={() => setExpanded(isExpanded ? null : h.id)}
                    className="border-t border-outline-variant/50 cursor-pointer hover:bg-surface-container-low transition-colors"
                  >
                    <td className="py-sm px-md font-mono">{h.instrument.ticker}</td>
                    <td className="py-sm pr-md text-on-surface-variant">{h.instrument.name}</td>
                    <td className="py-sm pr-md text-right font-mono">{Number(h.total_cantidad).toFixed(2)}</td>
                    <td className="py-sm pr-md text-right font-mono">
                      {h.precio_medio ? Number(h.precio_medio).toFixed(4) : "-"}
                    </td>
                    <td className="py-sm pr-md text-right font-mono">
                      {h.current_price ? `${Number(h.current_price).toFixed(4)}` : "-"}
                    </td>
                    <td className="py-sm pr-md text-right font-mono">{h.valor_actual_eur.toFixed(2)}</td>
                    <td className={`py-sm pr-md text-right font-mono ${h.plusvalia_no_realizada >= 0 ? "text-positive" : "text-critical"}`}>
                      {h.plusvalia_no_realizada >= 0 ? "+" : ""}{h.plusvalia_no_realizada.toFixed(2)}
                    </td>
                    <td className={`py-sm pr-md text-right font-mono ${h.roi >= 0 ? "text-positive" : "text-critical"}`}>
                      {h.roi >= 0 ? "+" : ""}{h.roi.toFixed(2)}%
                    </td>
                    <td className="py-sm text-right text-on-surface-variant text-[11px]">
                      {h.instrument.price_updated_at
                        ? new Date(h.instrument.price_updated_at).toLocaleDateString("es")
                        : "-"}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${h.id}-lots`}>
                      <td colSpan={9} className="px-md py-md bg-surface-dim/30">
                        <div className="text-label-caps text-on-surface-variant mb-sm">{t("investments.fifo_detail")}</div>
                        {h.lots.length === 0 ? (
                          <span className="text-body-sm text-on-surface-variant">Sin lotes</span>
                        ) : (
                          <table className="w-full text-body-sm">
                            <thead>
                              <tr className="text-label-caps text-on-surface-variant">
                                <th className="text-left py-xs pr-md">Fecha</th>
                                <th className="text-right py-xs pr-md">Original</th>
                                <th className="text-right py-xs pr-md">Restante</th>
                                <th className="text-right py-xs pr-md">Precio</th>
                                <th className="text-right py-xs pr-md">Total (divisa)</th>
                                <th className="text-right py-xs">Total (EUR)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {h.lots.map((lot: any) => (
                                <tr key={lot.id} className="border-t border-outline-variant/30">
                                  <td className="py-xs pr-md">{new Date(lot.fecha_compra).toLocaleDateString("es")}</td>
                                  <td className="py-xs pr-md text-right font-mono">{Number(lot.cantidad_original).toFixed(2)}</td>
                                  <td className="py-xs pr-md text-right font-mono">{Number(lot.cantidad_restante).toFixed(2)}</td>
                                  <td className="py-xs pr-md text-right font-mono">{Number(lot.precio_unitario).toFixed(4)}</td>
                                  <td className="py-xs pr-md text-right font-mono">{Number(lot.total_original).toFixed(2)} {lot.divisa}</td>
                                  <td className="py-xs text-right font-mono">{Number(lot.total_eur).toFixed(2)} €</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function DividendsTab() {
  const [dividends, setDividends] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/investments/transactions?type=DIVIDEND")
      .then((r) => r.json())
      .then(setDividends);
  }, []);

  if (dividends.length === 0) {
    return (
      <div className="text-center py-xl text-body-sm text-on-surface-variant">
        {t("investments.no_dividends")}
      </div>
    );
  }

  const totalEur = dividends.reduce((s, d) => s + Number(d.importe_eur), 0);

  return (
    <div className="space-y-lg">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <StatCard label={t("investments.total")} value={`${totalEur.toFixed(2)} €`} />
        <StatCard label={t("investments.quantity")} value={String(dividends.length)} />
      </div>

      <section className="bg-surface-container border border-outline-variant rounded-xl overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="text-label-caps text-on-surface-variant border-b border-outline-variant">
              <th className="text-left py-sm px-md">{t("investments.date") || "Fecha"}</th>
              <th className="text-left py-sm pr-md">{t("investments.ticker")}</th>
              <th className="text-right py-sm pr-md">{t("investments.quantity")}</th>
              <th className="text-right py-sm pr-md">{t("investments.original_amount")}</th>
              <th className="text-right py-sm pr-md">{t("investments.amount_eur")}</th>
              <th className="text-right py-sm">{t("investments.reinvested")}</th>
            </tr>
          </thead>
          <tbody>
            {dividends.map((d: any) => (
              <tr key={d.id} className="border-t border-outline-variant/50">
                <td className="py-sm px-md">{new Date(d.date).toLocaleDateString("es")}</td>
                <td className="py-sm pr-md font-mono">{d.instrument.ticker}</td>
                <td className="py-sm pr-md text-right">{Number(d.cantidad).toFixed(2)}</td>
                <td className="py-sm pr-md text-right font-mono">{Number(d.importe_total).toFixed(2)} {d.divisa}</td>
                <td className="py-sm pr-md text-right font-mono">{Number(d.importe_eur).toFixed(2)} €</td>
                <td className="py-sm text-right">{d.dividend_reinvested ? "Sí" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function OperationsTab() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [instruments, setInstruments] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    instrument_id: "", type: "BUY", cantidad: "", precio_unitario: "",
    divisa: "EUR", exchange_rate: "1", date: new Date().toISOString().split("T")[0],
    account_id: "", comentarios: "", is_recurring: false, recurring_period: "",
    dividend_reinvested: false, new_ticker: "", new_name: "", new_type: "STOCK",
  });

  const fetchData = () => {
    fetch("/api/investments/transactions")
      .then((r) => r.json())
      .then(setTransactions);
    fetch("/api/investments/instruments")
      .then((r) => r.json())
      .then(setInstruments);
    fetch("/api/accounts")
      .then((r) => r.json())
      .then(setAccounts);
  };

  useEffect(() => { fetchData(); }, []);

  const handleInstrumentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "__new__") {
      setForm({ ...form, instrument_id: val });
    } else {
      const inst = instruments.find((i) => i.id === val);
      setForm({ ...form, instrument_id: val, divisa: inst?.currency || "EUR", exchange_rate: inst?.currency === "EUR" ? "1" : form.exchange_rate });
    }
  };

  const submitOperation = async () => {
    let instrumentId = form.instrument_id;

    if (instrumentId === "__new__") {
      const res = await fetch("/api/investments/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: form.new_ticker,
          name: form.new_name,
          type: form.new_type,
          currency: form.divisa,
        }),
      });
      const created = await res.json();
      instrumentId = created.id;
    }

    await fetch("/api/investments/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, instrument_id: instrumentId, cantidad: Number(form.cantidad), precio_unitario: Number(form.precio_unitario), exchange_rate: Number(form.exchange_rate) }),
    });

    setShowForm(false);
    setForm({
      instrument_id: "", type: "BUY", cantidad: "", precio_unitario: "",
      divisa: "EUR", exchange_rate: "1", date: new Date().toISOString().split("T")[0],
      account_id: "", comentarios: "", is_recurring: false, recurring_period: "",
      dividend_reinvested: false, new_ticker: "", new_name: "", new_type: "STOCK",
    });
    fetchData();
  };

  const deleteOperation = async (id: string) => {
    if (!confirm(t("investments.confirm_delete"))) return;
    await fetch(`/api/investments/transactions/${id}`, { method: "DELETE" });
    fetchData();
  };

  const repeatOperation = async (tx: any) => {
    await fetch("/api/investments/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: tx.type,
        instrument_id: tx.instrument_id,
        cantidad: Math.abs(Number(tx.cantidad)),
        precio_unitario: Number(tx.precio_unitario),
        divisa: tx.divisa,
        exchange_rate: Number(tx.exchange_rate),
        date: new Date().toISOString(),
      }),
    });
    fetchData();
  };

  return (
    <div className="space-y-lg">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary text-on-primary px-lg py-md rounded-lg text-body-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {showForm ? "Cancelar" : t("investments.new_operation")}
        </button>
      </div>

      {showForm && (
        <section className="bg-surface-container border border-outline-variant p-lg rounded-xl space-y-md">
          <h3 className="text-body-md font-semibold text-on-surface">{t("investments.new_operation")}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
            <div className="flex flex-col gap-sm">
              <label className="text-label-caps text-on-surface-variant">{t("investments.type")}</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="bg-surface text-on-surface border border-outline-variant rounded-lg px-md py-sm text-body-sm">
                <option value="BUY">{t("investments.buy")}</option>
                <option value="SELL">{t("investments.sell")}</option>
                <option value="DIVIDEND">{t("investments.dividend")}</option>
              </select>
            </div>

            <div className="flex flex-col gap-sm">
              <label className="text-label-caps text-on-surface-variant">{t("investments.ticker")}</label>
              <select value={form.instrument_id} onChange={handleInstrumentChange}
                className="bg-surface text-on-surface border border-outline-variant rounded-lg px-md py-sm text-body-sm">
                <option value="">-- {t("investments.name")} --</option>
                {instruments.map((inst: any) => (
                  <option key={inst.id} value={inst.id}>{inst.ticker} - {inst.name}</option>
                ))}
                <option value="__new__">+ Nuevo instrumento</option>
              </select>
            </div>

            {form.instrument_id === "__new__" && (
              <>
                <div className="flex flex-col gap-sm">
                  <label className="text-label-caps text-on-surface-variant">{t("investments.ticker")}</label>
                  <input value={form.new_ticker} onChange={(e) => setForm({ ...form, new_ticker: e.target.value })}
                    className="bg-surface text-on-surface border border-outline-variant rounded-lg px-md py-sm text-body-sm" placeholder="AAPL" />
                </div>
                <div className="flex flex-col gap-sm">
                  <label className="text-label-caps text-on-surface-variant">{t("investments.name")}</label>
                  <input value={form.new_name} onChange={(e) => setForm({ ...form, new_name: e.target.value })}
                    className="bg-surface text-on-surface border border-outline-variant rounded-lg px-md py-sm text-body-sm" placeholder="Apple Inc." />
                </div>
                <div className="flex flex-col gap-sm">
                  <label className="text-label-caps text-on-surface-variant">{t("investments.type")}</label>
                  <select value={form.new_type} onChange={(e) => setForm({ ...form, new_type: e.target.value })}
                    className="bg-surface text-on-surface border border-outline-variant rounded-lg px-md py-sm text-body-sm">
                    <option value="STOCK">Stock</option>
                    <option value="ETF">ETF</option>
                    <option value="FUND">Fund</option>
                  </select>
                </div>
              </>
            )}

            <div className="flex flex-col gap-sm">
              <label className="text-label-caps text-on-surface-variant">{t("investments.date") || "Fecha"}</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="bg-surface text-on-surface border border-outline-variant rounded-lg px-md py-sm text-body-sm" />
            </div>

            <div className="flex flex-col gap-sm">
              <label className="text-label-caps text-on-surface-variant">{t("investments.quantity")}</label>
              <input type="number" step="any" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                className="bg-surface text-on-surface border border-outline-variant rounded-lg px-md py-sm text-body-sm" />
            </div>

            <div className="flex flex-col gap-sm">
              <label className="text-label-caps text-on-surface-variant">{t("investments.current_price")}</label>
              <input type="number" step="any" value={form.precio_unitario} onChange={(e) => setForm({ ...form, precio_unitario: e.target.value })}
                className="bg-surface text-on-surface border border-outline-variant rounded-lg px-md py-sm text-body-sm" />
            </div>

            <div className="flex flex-col gap-sm">
              <label className="text-label-caps text-on-surface-variant">{t("investments.currency")}</label>
              <input value={form.divisa} onChange={(e) => setForm({ ...form, divisa: e.target.value })}
                className="bg-surface text-on-surface border border-outline-variant rounded-lg px-md py-sm text-body-sm" placeholder="EUR" />
            </div>

            <div className="flex flex-col gap-sm">
              <label className="text-label-caps text-on-surface-variant">{t("investments.exchange_rate")}</label>
              <input type="number" step="any" value={form.exchange_rate} onChange={(e) => setForm({ ...form, exchange_rate: e.target.value })}
                className="bg-surface text-on-surface border border-outline-variant rounded-lg px-md py-sm text-body-sm" />
            </div>

            <div className="flex flex-col gap-sm">
              <label className="text-label-caps text-on-surface-variant">{t("investments.bank_select") || "Cuenta Bancaria"}</label>
              <select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}
                className="bg-surface text-on-surface border border-outline-variant rounded-lg px-md py-sm text-body-sm">
                <option value="">Sin cuenta</option>
                {accounts.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.account_label || a.iban}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-sm">
              <label className="text-label-caps text-on-surface-variant">{t("investments.comments") || "Comentarios"}</label>
              <input value={form.comentarios} onChange={(e) => setForm({ ...form, comentarios: e.target.value })}
                className="bg-surface text-on-surface border border-outline-variant rounded-lg px-md py-sm text-body-sm" />
            </div>

            {form.type === "DIVIDEND" && (
              <div className="flex items-center gap-sm">
                <input type="checkbox" id="reinvested" checked={form.dividend_reinvested}
                  onChange={(e) => setForm({ ...form, dividend_reinvested: e.target.checked })}
                  className="accent-primary" />
                <label htmlFor="reinvested" className="text-body-sm text-on-surface">{t("investments.reinvested")}</label>
              </div>
            )}

            {form.type === "BUY" && (
              <div className="flex items-center gap-sm">
                <input type="checkbox" id="recurring" checked={form.is_recurring}
                  onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })}
                  className="accent-primary" />
                <label htmlFor="recurring" className="text-body-sm text-on-surface">{t("investments.recurring")}</label>
                {form.is_recurring && (
                  <select value={form.recurring_period} onChange={(e) => setForm({ ...form, recurring_period: e.target.value })}
                    className="bg-surface text-on-surface border border-outline-variant rounded-lg px-md py-sm text-body-sm ml-sm">
                    <option value="mensual">{t("investments.monthly")}</option>
                    <option value="anual">{t("investments.annual")}</option>
                  </select>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-sm">
            <button onClick={submitOperation}
              className="bg-primary text-on-primary px-lg py-md rounded-lg text-body-sm font-medium hover:bg-primary/90 transition-colors">
              {t("investments.register")}
            </button>
          </div>
        </section>
      )}

      <section className="bg-surface-container border border-outline-variant rounded-xl overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="text-label-caps text-on-surface-variant border-b border-outline-variant">
              <th className="text-left py-sm px-md">{t("investments.date") || "Fecha"}</th>
              <th className="text-left py-sm pr-md">{t("investments.ticker")}</th>
              <th className="text-left py-sm pr-md">{t("investments.type")}</th>
              <th className="text-right py-sm pr-md">{t("investments.quantity")}</th>
              <th className="text-right py-sm pr-md">{t("investments.current_price")}</th>
              <th className="text-right py-sm pr-md">{t("investments.original_amount")}</th>
              <th className="text-right py-sm pr-md">{t("investments.amount_eur")}</th>
              <th className="text-right py-sm pr-md">{t("investments.profit_loss")}</th>
              <th className="text-right py-sm pr-md">{t("investments.recurring")}</th>
              <th className="text-right py-sm">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx: any) => (
              <tr key={tx.id} className="border-t border-outline-variant/50">
                <td className="py-sm px-md">{new Date(tx.date).toLocaleDateString("es")}</td>
                <td className="py-sm pr-md font-mono">{tx.instrument?.ticker}</td>
                <td className="py-sm pr-md">
                  <span className={`px-sm py-0.5 rounded text-[11px] font-medium ${
                    tx.type === "BUY" ? "bg-positive/10 text-positive"
                    : tx.type === "SELL" ? "bg-critical/10 text-critical"
                    : "bg-primary/10 text-primary"
                  }`}>
                    {tx.type}
                  </span>
                </td>
                <td className="py-sm pr-md text-right font-mono">{Math.abs(Number(tx.cantidad)).toFixed(2)}</td>
                <td className="py-sm pr-md text-right font-mono">{Number(tx.precio_unitario).toFixed(4)}</td>
                <td className="py-sm pr-md text-right font-mono">{Number(tx.importe_total).toFixed(2)} {tx.divisa}</td>
                <td className="py-sm pr-md text-right font-mono">{Number(tx.importe_eur).toFixed(2)} €</td>
                <td className={`py-sm pr-md text-right font-mono ${tx.plusvalia_realizada_eur ? (Number(tx.plusvalia_realizada_eur) >= 0 ? "text-positive" : "text-critical") : ""}`}>
                  {tx.plusvalia_realizada_eur ? `${Number(tx.plusvalia_realizada_eur) >= 0 ? "+" : ""}${Number(tx.plusvalia_realizada_eur).toFixed(2)}` : "-"}
                </td>
                <td className="py-sm pr-md text-right">{tx.is_recurring ? tx.recurring_period : "-"}</td>
                <td className="py-sm text-right">
                  <div className="flex items-center justify-end gap-sm">
                    {tx.is_recurring && (
                      <button onClick={() => repeatOperation(tx)}
                        className="text-body-sm text-primary hover:text-primary/80 transition-colors">
                        {t("investments.repeat_operation")}
                      </button>
                    )}
                    <button onClick={() => deleteOperation(tx.id)}
                      className="text-body-sm text-critical hover:text-critical/80 transition-colors">
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
