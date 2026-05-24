"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { t } from "@/lib/i18n";
import { fmtEs, fmtDate } from "@/lib/format";
import CrowdlendingTab from "@/components/CrowdlendingTab";

type Tab = "portfolio" | "holdings" | "dividends" | "operations" | "crowdlending";

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Lookup result type
type LookupResult = {
  ticker: string;
  isin: string | null;
  name: string;
  currency: string;
  type: string;
  current_price: number | null;
  exchange_rate: number | null;
  source: "local" | "yahoo";
};

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
        <StatCard label={t("investments.total_value")} value={`${fmtEs(summary.valor_total)} €`} />
        <StatCard label={t("investments.total_invested")} value={`${fmtEs(summary.total_invertido)} €`} />
        <StatCard label={t("investments.total_return")} value={`${summary.rentabilidad_total.toFixed(2)}%`} positive={summary.rentabilidad_total >= 0} />
        <StatCard label={t("investments.unrealized_gains")} value={`${fmtEs(summary.plusvalias_no_realizadas)} €`} positive={summary.plusvalias_no_realizadas >= 0} />
        <StatCard label={t("investments.annual_dividends")} value={`${fmtEs(summary.dividendos_anuales)} €`} />
        <StatCard label={t("investments.dividend_yield")} value={`${summary.dividend_yield.toFixed(2)}%`} />
        <StatCard label={t("investments.realized_return")} value={`${fmtEs(summary.plusvalias_realizadas)} €`} positive={summary.plusvalias_realizadas >= 0} />
      </div>

      <section className="bg-surface-container border border-outline-variant p-lg rounded-xl">
        <h3 className="text-body-md font-semibold text-on-surface mb-md">{t("investments.type")}</h3>
        <div className="space-y-sm">
          {Object.entries(summary.tipo_allocation || {}).map(([tipo, valor]) => (
            <div key={tipo} className="flex justify-between text-body-sm">
              <span className="text-on-surface-variant">{tipo}</span>
              <span className="text-on-surface">{fmtEs(Number(valor))} €</span>
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
                <td className="py-sm pr-md text-right font-mono">{fmtEs(item.valor)} €</td>
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
                        ? fmtDate(h.instrument.price_updated_at)
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
                                  <td className="py-xs pr-md">{fmtDate(lot.fecha_compra)}</td>
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
  const [yearFilter, setYearFilter] = useState<string>("");

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

  // Get available years
  const years = [...new Set(dividends.map((d) => new Date(d.date).getFullYear().toString()))].sort().reverse();
  
  // Filter by year
  const filtered = yearFilter 
    ? dividends.filter((d) => new Date(d.date).getFullYear().toString() === yearFilter)
    : dividends;

  // Totals
  const totalBrutoEur = filtered.reduce((s, d) => s + (Number(d.importe_bruto_eur) || 0), 0);
  const totalRetOrigen = filtered.reduce((s, d) => s + (Number(d.retencion_origen_eur) || 0), 0);
  const totalRetEsp = filtered.reduce((s, d) => s + (Number(d.retencion_esp_eur) || 0), 0);
  const totalNetoEur = filtered.reduce((s, d) => s + Number(d.importe_eur), 0);

  return (
    <div className="space-y-lg">
      {/* Year filter */}
      <div className="flex gap-sm items-center">
        <span className="text-body-sm text-on-surface-variant">Año:</span>
        <button
          onClick={() => setYearFilter("")}
          className={`px-2 py-1 rounded text-label-caps transition-colors ${
            !yearFilter ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
          }`}
        >
          Todos
        </button>
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setYearFilter(y)}
            className={`px-2 py-1 rounded text-label-caps transition-colors ${
              yearFilter === y ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter">
        <StatCard label="Bruto Total" value={`${fmtEs(totalBrutoEur)} €`} />
        <StatCard label="Ret. Origen" value={`-${fmtEs(totalRetOrigen)} €`} />
        <StatCard label="Ret. España" value={`-${fmtEs(totalRetEsp)} €`} />
        <StatCard label="Neto Total" value={`${fmtEs(totalNetoEur)} €`} positive />
      </div>

      {/* IRPF Summary */}
      <section className="bg-tertiary/5 border border-tertiary/20 rounded-xl p-lg">
        <h4 className="text-body-md font-semibold text-tertiary mb-md flex items-center gap-sm">
          <span className="material-symbols-outlined text-lg">description</span>
          Resumen IRPF {yearFilter || "Total"}
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-md text-body-sm">
          <div>
            <span className="text-on-surface-variant">Dividendos recibidos:</span>
            <span className="ml-2 font-mono text-on-surface">{filtered.length}</span>
          </div>
          <div>
            <span className="text-on-surface-variant">Base imponible (Bruto):</span>
            <span className="ml-2 font-mono text-on-surface">{fmtEs(totalBrutoEur)} €</span>
          </div>
          <div>
            <span className="text-on-surface-variant">Doble imposición (Ret. Origen):</span>
            <span className="ml-2 font-mono text-on-surface">{fmtEs(totalRetOrigen)} €</span>
          </div>
          <div>
            <span className="text-on-surface-variant">Retención España:</span>
            <span className="ml-2 font-mono text-on-surface">{fmtEs(totalRetEsp)} €</span>
          </div>
        </div>
      </section>

      <section className="bg-surface-container border border-outline-variant rounded-xl overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="text-label-caps text-on-surface-variant border-b border-outline-variant">
              <th className="text-left py-sm px-md">Fecha</th>
              <th className="text-left py-sm pr-md">Instrumento</th>
              <th className="text-right py-sm pr-md">Títulos</th>
              <th className="text-right py-sm pr-md">Bruto €</th>
              <th className="text-right py-sm pr-md">Ret. Origen</th>
              <th className="text-right py-sm pr-md">Ret. ESP</th>
              <th className="text-right py-sm pr-md">Neto €</th>
              <th className="text-right py-sm">Reinv.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d: any) => (
              <tr key={d.id} className="border-t border-outline-variant/50">
                <td className="py-sm px-md">{fmtDate(d.date)}</td>
                <td className="py-sm pr-md">
                  <span className="font-mono">{d.instrument?.ticker || d.instrument?.isin}</span>
                  <span className="ml-2 text-on-surface-variant text-[11px]">{d.instrument?.name}</span>
                </td>
                <td className="py-sm pr-md text-right">{Number(d.cantidad).toFixed(0)}</td>
                <td className="py-sm pr-md text-right font-mono">
                  {d.importe_bruto_eur ? fmtEs(Number(d.importe_bruto_eur)) : "-"}
                </td>
                <td className="py-sm pr-md text-right font-mono text-warning">
                  {d.retencion_origen_eur ? (
                    <span title={`${(Number(d.retencion_origen_pct) * 100).toFixed(0)}%`}>
                      -{fmtEs(Number(d.retencion_origen_eur))}
                    </span>
                  ) : "-"}
                </td>
                <td className="py-sm pr-md text-right font-mono text-error">
                  {d.retencion_esp_eur ? (
                    <span title={`${(Number(d.retencion_esp_pct) * 100).toFixed(0)}%`}>
                      -{fmtEs(Number(d.retencion_esp_eur))}
                    </span>
                  ) : "-"}
                </td>
                <td className="py-sm pr-md text-right font-mono font-semibold text-positive">
                  {fmtEs(Number(d.importe_eur))}
                </td>
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
    dividend_reinvested: false, new_ticker: "", new_name: "", new_type: "STOCK", new_isin: "",
  });
  
  // Autocomplete state
  const [searchQuery, setSearchQuery] = useState("");
  const [lookupResults, setLookupResults] = useState<LookupResult[]>([]);
  const [showLookup, setShowLookup] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const lookupRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(searchQuery, 400);
  
  // Form validation
  const [validationError, setValidationError] = useState("");
  
  // Fetch lookup results
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setLookupResults([]);
      return;
    }
    
    setLookupLoading(true);
    fetch(`/api/investments/instruments/lookup?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((data) => {
        setLookupResults(data.results || []);
        setShowLookup(true);
      })
      .catch(() => setLookupResults([]))
      .finally(() => setLookupLoading(false));
  }, [debouncedQuery]);
  
  // Close lookup on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (lookupRef.current && !lookupRef.current.contains(e.target as Node)) {
        setShowLookup(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  // Select lookup result
  const selectLookupResult = (result: LookupResult) => {
    setForm({
      ...form,
      new_ticker: result.ticker,
      new_name: result.name,
      new_isin: result.isin || "",
      new_type: result.type,
      divisa: result.currency,
      exchange_rate: result.exchange_rate?.toString() || "1",
      precio_unitario: result.current_price?.toString() || form.precio_unitario,
    });
    setSearchQuery("");
    setShowLookup(false);
    setLookupResults([]);
  };

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
    // Validate account_id is required for manual operations
    if (!form.account_id) {
      setValidationError("Debes seleccionar una cuenta bancaria para registrar la operación");
      return;
    }
    
    let instrumentId = form.instrument_id;

    if (instrumentId === "__new__") {
      // Validate at least ticker or isin
      if (!form.new_ticker && !form.new_isin) {
        setValidationError("Debes introducir al menos el ticker o el ISIN del instrumento");
        return;
      }
      
      const res = await fetch("/api/investments/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: form.new_ticker || null,
          isin: form.new_isin || null,
          name: form.new_name,
          type: form.new_type,
          currency: form.divisa,
        }),
      });
      const created = await res.json();
      if (!res.ok) {
        setValidationError(created.error || "Error al crear instrumento");
        return;
      }
      instrumentId = created.id;
    }
    
    setValidationError("");

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
      dividend_reinvested: false, new_ticker: "", new_name: "", new_type: "STOCK", new_isin: "",
    });
    setSearchQuery("");
    fetchData();
  };

  const deleteOperation = async (id: string) => {
    if (!confirm(t("investments.confirm_delete"))) return;
    const res = await fetch(`/api/investments/transactions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Error al eliminar la operación");
      return;
    }
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
          
          {validationError && (
            <div className="bg-critical/10 border border-critical/30 text-critical px-md py-sm rounded-lg text-body-sm">
              {validationError}
            </div>
          )}

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
                <div className="flex flex-col gap-sm col-span-full">
                  <label className="text-label-caps text-on-surface-variant">Buscar instrumento (Yahoo Finance)</label>
                  <div className="relative" ref={lookupRef}>
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => lookupResults.length > 0 && setShowLookup(true)}
                      className="bg-surface text-on-surface border border-outline-variant rounded-lg px-md py-sm text-body-sm w-full"
                      placeholder="Buscar por ticker, ISIN o nombre..."
                    />
                    {lookupLoading && (
                      <span className="absolute right-md top-1/2 -translate-y-1/2 text-body-sm text-on-surface-variant">...</span>
                    )}
                    {showLookup && lookupResults.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface border border-outline-variant rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {lookupResults.map((result, idx) => (
                          <button
                            key={`${result.ticker}-${idx}`}
                            type="button"
                            onClick={() => selectLookupResult(result)}
                            className="w-full px-md py-sm text-left hover:bg-surface-container-low transition-colors border-b border-outline-variant/30 last:border-b-0"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-mono text-body-sm text-on-surface">{result.ticker}</span>
                              <span className={`text-[10px] px-sm py-0.5 rounded ${result.source === "local" ? "bg-primary/10 text-primary" : "bg-tertiary/10 text-tertiary"}`}>
                                {result.source === "local" ? "Local" : "Yahoo"}
                              </span>
                            </div>
                            <div className="text-body-sm text-on-surface-variant truncate">{result.name}</div>
                            <div className="flex gap-md text-[11px] text-on-surface-variant mt-0.5">
                              <span>{result.type}</span>
                              <span>{result.currency}</span>
                              {result.current_price && <span>{result.current_price.toFixed(2)} {result.currency}</span>}
                              {result.isin && <span>ISIN: {result.isin}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-sm">
                  <label className="text-label-caps text-on-surface-variant">{t("investments.ticker")} *</label>
                  <input value={form.new_ticker} onChange={(e) => setForm({ ...form, new_ticker: e.target.value })}
                    className="bg-surface text-on-surface border border-outline-variant rounded-lg px-md py-sm text-body-sm" placeholder="AAPL" />
                </div>
                <div className="flex flex-col gap-sm">
                  <label className="text-label-caps text-on-surface-variant">ISIN *</label>
                  <input value={form.new_isin} onChange={(e) => setForm({ ...form, new_isin: e.target.value })}
                    className="bg-surface text-on-surface border border-outline-variant rounded-lg px-md py-sm text-body-sm" placeholder="US0378331005" />
                  <span className="text-[10px] text-on-surface-variant">* Al menos ticker o ISIN requerido</span>
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
                    <option value="ETC">ETC</option>
                    <option value="FUND">Fund</option>
                    <option value="RIGHT">Derechos</option>
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
              <label className="text-label-caps text-on-surface-variant">{t("investments.bank_select") || "Cuenta Bancaria"} *</label>
              <select value={form.account_id} onChange={(e) => { setForm({ ...form, account_id: e.target.value }); setValidationError(""); }}
                className={`bg-surface text-on-surface border rounded-lg px-md py-sm text-body-sm ${!form.account_id && validationError ? "border-critical" : "border-outline-variant"}`}>
                <option value="">-- Selecciona cuenta --</option>
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
                <td className="py-sm px-md">{fmtDate(tx.date)}</td>
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
