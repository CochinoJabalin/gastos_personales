"use client";

import { useState, useEffect } from "react";
import { fmtEs } from "@/lib/format";

interface PreviewRow {
  line: number;
  fecha: string;
  fechaISO: string;
  operacion: "BUY" | "SELL" | "DIVIDEND";
  descripcion: string;
  ticker: string | null;
  isin: string | null;
  titulos: number;
  precioUnidad: number;
  divisa: string;
  comisionDivisa: number;
  tipoCambio: number;
  importeNetoEur: number;
  instrumentType: string;
  instrumentExists: boolean;
  instrumentId: string | null;
  duplicate: { id: string; date: string; cantidad: number } | null;
  errors: string[];
}

interface NewInstrument {
  ticker: string | null;
  isin: string | null;
  name: string;
  currency: string;
  type: string;
}

interface Account {
  id: string;
  account_label: string;
  bank: { bank_name: string };
}

export default function InvestmentsImport() {
  const [separator, setSeparator] = useState(";");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [newInstruments, setNewInstruments] = useState<NewInstrument[]>([]);
  const [conflicts, setConflicts] = useState<Record<string, "create" | "skip" | "replace">>({});
  const [applyAll, setApplyAll] = useState<"create" | "skip" | "replace" | null>(null);
  const [yearFilter, setYearFilter] = useState<string[]>([]);
  const [result, setResult] = useState<{ created: number; replaced: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      setAccounts(data);
      // Find MyInvestor account by default
      const myinvestor = data.find((a: Account) => 
        a.bank.bank_name.toLowerCase().includes("myinvestor") ||
        a.account_label.toLowerCase().includes("myinvestor")
      );
      if (myinvestor) {
        setSelectedAccountId(myinvestor.id);
      } else if (data.length > 0) {
        setSelectedAccountId(data[0].id);
      }
    } catch {}
  }

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError("");
    setPreview(null);
    setResult(null);
    setConflicts({});
    setApplyAll(null);
    setNewInstruments([]);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("separator", separator);

    try {
      const res = await fetch("/api/investments/transactions/import/preview", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error del servidor");
      } else {
        setPreview(data.rows);
        setNewInstruments(data.new_instruments || []);
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  const filtered = preview
    ? preview.filter((r) => {
        const y = r.fechaISO.split("-")[0];
        if (yearFilter.length > 0 && !yearFilter.includes(y)) return false;
        return true;
      })
    : [];

  const availableYears = preview
    ? [...new Set(preview.map((r) => r.fechaISO.split("-")[0]))].sort()
    : [];

  function resolveConflict(key: string, decision: "create" | "skip" | "replace") {
    setConflicts((prev) => ({ ...prev, [key]: decision }));
  }

  function resolveAll(decision: "create" | "skip" | "replace") {
    setApplyAll(decision);
    const next: Record<string, "create" | "skip" | "replace"> = {};
    for (const r of filtered) {
      if (r.duplicate) {
        next[`${r.isin || r.ticker}|${r.fechaISO}|${r.titulos}`] = decision;
      }
    }
    setConflicts(next);
  }

  async function handleImport() {
    if (!selectedAccountId) {
      setError("Selecciona una cuenta de broker");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const items = filtered
      .filter((r) => r.errors.length === 0)
      .map((r) => {
        const key = `${r.isin || r.ticker}|${r.fechaISO}|${r.titulos}`;
        const decision = r.duplicate ? (conflicts[key] || "skip") : "create";
        return {
          action: decision as "create" | "skip" | "replace",
          duplicateId: r.duplicate?.id,
          fechaISO: r.fechaISO,
          operacion: r.operacion,
          descripcion: r.descripcion,
          ticker: r.ticker,
          isin: r.isin,
          titulos: r.titulos,
          precioUnidad: r.precioUnidad,
          divisa: r.divisa,
          tipoCambio: r.tipoCambio,
          importeNetoEur: r.importeNetoEur,
          instrumentType: r.instrumentType,
          instrumentId: r.instrumentId,
        };
      });

    try {
      const res = await fetch("/api/investments/transactions/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, account_id: selectedAccountId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error del servidor");
      } else {
        setResult(data);
        setPreview(null);
        setFile(null);
        setConflicts({});
        setApplyAll(null);
        setNewInstruments([]);
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  const hasDuplicates = filtered.some((r) => r.duplicate);
  const hasErrors = filtered.some((r) => r.errors.length > 0);
  const unresolved = filtered.some((r) => r.duplicate && !conflicts[`${r.isin || r.ticker}|${r.fechaISO}|${r.titulos}`]);

  return (
    <div>
      <div className="flex gap-md mb-lg flex-wrap">
        <div className="w-20">
          <label className="text-label-caps text-on-surface-variant uppercase block mb-1">Separador</label>
          <input
            type="text"
            value={separator}
            onChange={(e) => setSeparator(e.target.value)}
            className="w-full bg-surface-container-high rounded-lg px-md py-md text-body-md text-on-surface border border-outline-variant focus:border-primary focus:outline-none"
            maxLength={2}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-label-caps text-on-surface-variant uppercase block mb-1">Cuenta Broker</label>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full bg-surface-container-high rounded-lg px-md py-md text-body-md text-on-surface border border-outline-variant focus:border-primary focus:outline-none"
          >
            <option value="">Seleccionar cuenta...</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.bank.bank_name} - {a.account_label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-md items-center mb-lg">
        <div className="flex-1">
          <label className="text-label-caps text-on-surface-variant uppercase block mb-1">Archivo CSV</label>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
              setResult(null);
              setError("");
            }}
            className="w-full text-body-md text-on-surface file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-primary-on file:cursor-pointer hover:file:opacity-90"
          />
        </div>
        <button
          onClick={handlePreview}
          disabled={loading || !file}
          className="bg-primary text-primary-on px-lg py-md rounded-lg text-label-caps hover:opacity-90 disabled:opacity-50 self-end"
        >
          {loading ? "Procesando..." : "Previsualizar"}
        </button>
      </div>

      {error && (
        <p className="mb-md text-body-sm text-error bg-error-container/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {newInstruments.length > 0 && (
        <div className="mb-md bg-primary/10 border border-primary/30 rounded-xl p-md">
          <p className="text-body-sm font-semibold text-primary mb-2">
            Se crearán {newInstruments.length} nuevos instrumentos:
          </p>
          <div className="flex flex-wrap gap-2">
            {newInstruments.map((inst, i) => (
              <span key={i} className="px-2 py-1 bg-primary/20 text-primary rounded text-label-caps">
                {inst.ticker || inst.isin} ({inst.type})
              </span>
            ))}
          </div>
        </div>
      )}

      {preview && (
        <div className="space-y-md">
          <div className="flex flex-wrap gap-sm items-end">
            <div>
              <label className="text-label-caps text-on-surface-variant uppercase block mb-1">Año</label>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setYearFilter([])}
                  className={`px-2 py-1 rounded text-label-caps transition-colors ${
                    yearFilter.length === 0
                      ? "bg-primary text-primary-on"
                      : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                  }`}
                >
                  Todos
                </button>
                {availableYears.map((y) => (
                  <button
                    key={y}
                    onClick={() =>
                      setYearFilter((prev) =>
                        prev.includes(y) ? prev.filter((v) => v !== y) : [...prev, y]
                      )
                    }
                    className={`px-2 py-1 rounded text-label-caps transition-colors ${
                      yearFilter.includes(y)
                        ? "bg-primary text-primary-on"
                        : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-body-sm text-on-surface-variant">
              {filtered.length} de {preview.length} filas
            </span>
          </div>

          {hasDuplicates && (
            <div className="bg-warning-container/20 border border-warning/30 rounded-xl p-md">
              <div className="flex items-center justify-between mb-sm flex-wrap gap-2">
                <p className="text-body-sm font-semibold text-warning">
                  Se detectaron {filtered.filter((r) => r.duplicate).length} duplicados
                </p>
                <div className="flex gap-sm">
                  <button
                    onClick={() => resolveAll("skip")}
                    className={`px-md py-sm rounded-lg text-label-caps transition-colors ${
                      applyAll === "skip"
                        ? "bg-primary-container text-on-primary-container"
                        : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                    }`}
                  >
                    Omitir todos
                  </button>
                  <button
                    onClick={() => resolveAll("replace")}
                    className={`px-md py-sm rounded-lg text-label-caps transition-colors ${
                      applyAll === "replace"
                        ? "bg-primary-container text-on-primary-container"
                        : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                    }`}
                  >
                    Reemplazar todos
                  </button>
                </div>
              </div>
            </div>
          )}

          {hasErrors && (
            <div className="bg-error-container/20 border border-error/30 rounded-xl p-md">
              <p className="text-body-sm font-semibold text-error">
                {filtered.filter((r) => r.errors.length > 0).length} filas con errores (se omitirán)
              </p>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto border border-outline-variant rounded-lg">
            <table className="w-full text-left text-data-mono">
              <thead>
                <tr className="bg-surface-container-high text-on-surface-variant sticky top-0">
                  <th className="py-sm px-2 text-label-caps">Fecha</th>
                  <th className="py-sm px-2 text-label-caps">Op</th>
                  <th className="py-sm px-2 text-label-caps">Descripción</th>
                  <th className="py-sm px-2 text-label-caps">ISIN/Ticker</th>
                  <th className="py-sm px-2 text-label-caps text-right">Títulos</th>
                  <th className="py-sm px-2 text-label-caps text-right">Precio</th>
                  <th className="py-sm px-2 text-label-caps text-right">Importe €</th>
                  <th className="py-sm px-2 text-label-caps">Estado</th>
                  {hasDuplicates && <th className="py-sm px-2 text-label-caps">Acción</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filtered.map((r, i) => {
                  const key = `${r.isin || r.ticker}|${r.fechaISO}|${r.titulos}`;
                  const resolution = conflicts[key];
                  const hasError = r.errors.length > 0;
                  const isNew = !r.instrumentExists;

                  return (
                    <tr
                      key={i}
                      className={`hover:bg-surface-container-high transition-colors ${
                        hasError
                          ? "bg-error-container/10"
                          : r.duplicate && !resolution
                            ? "bg-warning-container/10"
                            : isNew
                              ? "bg-primary/5"
                              : ""
                      }`}
                    >
                      <td className="py-md px-2 text-on-surface-variant whitespace-nowrap">{r.fecha}</td>
                      <td className="py-md px-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          r.operacion === "BUY"
                            ? "bg-positive/20 text-positive"
                            : r.operacion === "SELL"
                              ? "bg-error/20 text-error"
                              : "bg-primary/20 text-primary"
                        }`}>
                          {r.operacion === "BUY" ? "C" : r.operacion === "SELL" ? "V" : "D"}
                        </span>
                      </td>
                      <td className="py-md px-2 text-on-surface max-w-[200px] truncate" title={r.descripcion}>
                        {r.descripcion}
                      </td>
                      <td className="py-md px-2 text-on-surface-variant text-[11px]">
                        {r.ticker || r.isin}
                      </td>
                      <td className="py-md px-2 text-on-surface text-right">{r.titulos}</td>
                      <td className="py-md px-2 text-on-surface text-right">
                        {fmtEs(r.precioUnidad, 2)} {r.divisa !== "EUR" ? r.divisa : ""}
                      </td>
                      <td className={`py-md px-2 text-right font-medium ${
                        r.operacion === "BUY" ? "text-error" : "text-positive"
                      }`}>
                        {r.operacion === "BUY" ? "-" : "+"}{fmtEs(r.importeNetoEur, 2)}€
                      </td>
                      <td className="py-md px-2">
                        {hasError ? (
                          <span className="text-error text-[10px]" title={r.errors.join(", ")}>Error</span>
                        ) : r.duplicate ? (
                          <span className="text-warning text-[10px]">Duplicado</span>
                        ) : isNew ? (
                          <span className="text-primary text-[10px]">Nuevo</span>
                        ) : (
                          <span className="text-positive text-[10px]">OK</span>
                        )}
                      </td>
                      {hasDuplicates && (
                        <td className="py-md px-2">
                          {r.duplicate && !hasError ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => resolveConflict(key, "skip")}
                                className={`px-1.5 py-0.5 rounded text-[9px] transition-colors ${
                                  resolution === "skip"
                                    ? "bg-primary text-primary-on"
                                    : "bg-surface-container-high text-on-surface-variant hover:bg-primary/20"
                                }`}
                              >
                                Omitir
                              </button>
                              <button
                                onClick={() => resolveConflict(key, "replace")}
                                className={`px-1.5 py-0.5 rounded text-[9px] transition-colors ${
                                  resolution === "replace"
                                    ? "bg-primary text-primary-on"
                                    : "bg-surface-container-high text-on-surface-variant hover:bg-primary/20"
                                }`}
                              >
                                Reemplazar
                              </button>
                            </div>
                          ) : (
                            <span className="text-label-caps text-on-surface-variant/50">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <button
              onClick={handleImport}
              disabled={loading || unresolved || !selectedAccountId}
              className="w-full bg-primary text-primary-on py-md rounded-lg text-label-caps hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading
                ? "Importando..."
                : !selectedAccountId
                  ? "Selecciona una cuenta"
                  : unresolved
                    ? `Resuelve ${filtered.filter((r) => r.duplicate && !conflicts[`${r.isin || r.ticker}|${r.fechaISO}|${r.titulos}`]).length} duplicado(s)`
                    : `Importar ${filtered.filter((r) => r.errors.length === 0).length} operaciones`
              }
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="mt-md space-y-1">
          <p className="text-body-sm text-primary">
            {result.created} creadas, {result.replaced} reemplazadas, {result.skipped} omitidas
          </p>
          {result.errors?.map((err, i) => (
            <p key={i} className="text-body-sm text-error">{err}</p>
          ))}
        </div>
      )}
    </div>
  );
}
