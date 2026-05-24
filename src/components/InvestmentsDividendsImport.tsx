"use client";

import { useState, useEffect, useRef } from "react";
import { fmtEs } from "@/lib/format";

interface DividendPreviewRow {
  line: number;
  fecha: string;
  fechaISO: string;
  isin: string | null;
  ticker: string | null;
  nombre: string;
  titulos: number;
  dividendoPorTitulo: number | null;
  divisa: string;
  importeBrutoOrig: number | null;
  tipoCambio: number | null;
  importeBrutoEur: number | null;
  retencionOrigenPct: number | null;
  retencionEspPct: number | null;
  importeNetoEur: number;
  instrumentId: string | null;
  instrumentName: string | null;
  instrumentExists: boolean;
  duplicate: { id: string; date: string; importe: number } | null;
  errors: string[];
}

interface MissingInstrument {
  isin: string | null;
  ticker: string | null;
  name: string;
  currency: string;
}

interface Account {
  id: string;
  account_label: string;
  bank: { bank_name: string };
}

interface LookupResult {
  ticker: string;
  isin: string | null;
  name: string;
  currency: string;
  type: string;
  source: "local" | "yahoo";
}

export default function InvestmentsDividendsImport() {
  const [separator, setSeparator] = useState(";");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<DividendPreviewRow[] | null>(null);
  const [missingInstruments, setMissingInstruments] = useState<MissingInstrument[]>([]);
  const [conflicts, setConflicts] = useState<Record<string, "create" | "skip" | "replace">>({});
  const [applyAll, setApplyAll] = useState<"create" | "skip" | "replace" | null>(null);
  const [hideDuplicates, setHideDuplicates] = useState(false);
  const [result, setResult] = useState<{ created: number; replaced: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  
  // Instrument resolution
  const [resolvingIndex, setResolvingIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LookupResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      setAccounts(data);
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
    setMissingInstruments([]);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("separator", separator);

    try {
      const res = await fetch("/api/investments/dividends/import/preview", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error del servidor");
      } else {
        setPreview(data.rows);
        setMissingInstruments(data.missing_instruments || []);
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  // Filter rows
  const filtered = preview
    ? preview.filter((r) => {
        if (hideDuplicates && r.duplicate) return false;
        return true;
      })
    : [];

  function getConflictKey(r: DividendPreviewRow): string {
    return `${r.isin || r.ticker}|${r.fechaISO}|${r.importeNetoEur}`;
  }

  function resolveConflict(key: string, decision: "create" | "skip" | "replace") {
    setConflicts((prev) => ({ ...prev, [key]: decision }));
  }

  function resolveAll(decision: "create" | "skip" | "replace") {
    setApplyAll(decision);
    const next: Record<string, "create" | "skip" | "replace"> = {};
    for (const r of filtered) {
      if (r.duplicate) {
        next[getConflictKey(r)] = decision;
      }
    }
    setConflicts(next);
  }

  // Search for instruments
  function handleSearch(query: string) {
    setSearchQuery(query);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/investments/instruments/lookup?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
  }

  // Resolve instrument for a row
  function resolveInstrument(rowIndex: number, instrumentId: string, instrumentName: string) {
    if (!preview) return;
    const updated = [...preview];
    updated[rowIndex] = {
      ...updated[rowIndex],
      instrumentId,
      instrumentName,
      instrumentExists: true,
    };
    setPreview(updated);
    setResolvingIndex(null);
    setSearchQuery("");
    setSearchResults([]);
  }

  // Create new instrument for row
  async function createInstrumentForRow(rowIndex: number, type: string = "STOCK") {
    if (!preview) return;
    const row = preview[rowIndex];
    
    try {
      const res = await fetch("/api/investments/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: row.ticker,
          isin: row.isin,
          name: row.nombre || row.ticker || row.isin,
          type,
          currency: row.divisa,
        }),
      });
      const created = await res.json();
      if (res.ok) {
        resolveInstrument(rowIndex, created.id, created.name);
      } else {
        setError(created.error || "Error creando instrumento");
      }
    } catch {
      setError("Error de conexión");
    }
  }

  async function handleImport() {
    if (!selectedAccountId) {
      setError("Selecciona una cuenta de broker");
      return;
    }

    // Check all instruments are resolved
    const unresolved = filtered.filter((r) => !r.instrumentExists && r.errors.length === 0);
    if (unresolved.length > 0) {
      setError(`Hay ${unresolved.length} dividendos con instrumento no encontrado. Resuélvelos primero.`);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const items = filtered
      .filter((r) => r.errors.length === 0)
      .map((r) => {
        const key = getConflictKey(r);
        const decision = r.duplicate ? (conflicts[key] || "skip") : "create";
        return {
          action: decision as "create" | "skip" | "replace",
          duplicateId: r.duplicate?.id,
          fechaISO: r.fechaISO,
          isin: r.isin,
          ticker: r.ticker,
          nombre: r.nombre,
          titulos: r.titulos,
          dividendoPorTitulo: r.dividendoPorTitulo,
          divisa: r.divisa,
          importeBrutoOrig: r.importeBrutoOrig,
          tipoCambio: r.tipoCambio,
          importeBrutoEur: r.importeBrutoEur,
          retencionOrigenPct: r.retencionOrigenPct,
          retencionEspPct: r.retencionEspPct,
          importeNetoEur: r.importeNetoEur,
          instrumentId: r.instrumentId,
        };
      });

    try {
      const res = await fetch("/api/investments/dividends/import/commit", {
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
        setMissingInstruments([]);
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  const hasDuplicates = filtered.some((r) => r.duplicate);
  const hasUnresolved = filtered.some((r) => !r.instrumentExists);
  const unresolvedCount = filtered.filter((r) => r.duplicate && !conflicts[getConflictKey(r)]).length;

  return (
    <div>
      {/* Config row */}
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

      {/* File upload */}
      <div className="flex gap-md items-center mb-lg">
        <div className="flex-1">
          <label className="text-label-caps text-on-surface-variant uppercase block mb-1">Archivo CSV de Dividendos</label>
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

      {result && (
        <div className="mb-lg bg-positive/10 border border-positive/30 rounded-xl p-lg">
          <h4 className="text-body-md font-semibold text-positive mb-2">Importación completada</h4>
          <p className="text-body-sm text-on-surface">
            Creados: {result.created} | Reemplazados: {result.replaced} | Omitidos: {result.skipped}
          </p>
          {result.errors.length > 0 && (
            <div className="mt-2 text-body-sm text-error">
              {result.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
        </div>
      )}

      {/* Missing instruments warning */}
      {missingInstruments.length > 0 && (
        <div className="mb-md bg-warning/10 border border-warning/30 rounded-xl p-md">
          <p className="text-body-sm font-semibold text-warning mb-2">
            {missingInstruments.length} instrumento(s) no encontrados - debes resolverlos:
          </p>
          <div className="flex flex-wrap gap-2">
            {missingInstruments.map((inst, i) => (
              <span key={i} className="px-2 py-1 bg-warning/20 text-warning rounded text-label-caps">
                {inst.ticker || inst.isin} - {inst.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {preview && (
        <div className="space-y-md">
          {/* Filters and actions */}
          <div className="flex flex-wrap gap-sm items-center justify-between">
            <div className="flex gap-sm items-center">
              <label className="flex items-center gap-2 text-body-sm text-on-surface-variant">
                <input
                  type="checkbox"
                  checked={hideDuplicates}
                  onChange={(e) => setHideDuplicates(e.target.checked)}
                  className="accent-primary"
                />
                Ocultar duplicados
              </label>
            </div>

            {hasDuplicates && (
              <div className="flex gap-sm items-center">
                <span className="text-body-sm text-on-surface-variant">Duplicados:</span>
                <button
                  onClick={() => resolveAll("skip")}
                  className={`px-2 py-1 rounded text-label-caps ${applyAll === "skip" ? "bg-primary text-primary-on" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"}`}
                >
                  Omitir todos
                </button>
                <button
                  onClick={() => resolveAll("replace")}
                  className={`px-2 py-1 rounded text-label-caps ${applyAll === "replace" ? "bg-primary text-primary-on" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"}`}
                >
                  Reemplazar todos
                </button>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="flex gap-md text-body-sm">
            <span className="text-on-surface-variant">
              Total: <strong className="text-on-surface">{filtered.length}</strong>
            </span>
            <span className="text-positive">
              OK: {filtered.filter((r) => r.errors.length === 0 && r.instrumentExists && !r.duplicate).length}
            </span>
            <span className="text-warning">
              Duplicados: {filtered.filter((r) => r.duplicate).length}
            </span>
            <span className="text-error">
              Sin instrumento: {filtered.filter((r) => !r.instrumentExists).length}
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-outline-variant rounded-xl">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant text-left">
                  <th className="px-md py-sm">Fecha</th>
                  <th className="px-md py-sm">Instrumento</th>
                  <th className="px-md py-sm text-right">Títulos</th>
                  <th className="px-md py-sm text-right">Bruto</th>
                  <th className="px-md py-sm text-right">Ret. Origen</th>
                  <th className="px-md py-sm text-right">Ret. ESP</th>
                  <th className="px-md py-sm text-right">Neto EUR</th>
                  <th className="px-md py-sm">Estado</th>
                  <th className="px-md py-sm">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => {
                  const key = getConflictKey(row);
                  const decision = row.duplicate ? conflicts[key] : null;
                  const realIndex = preview.findIndex((r) => r.line === row.line);

                  return (
                    <tr
                      key={row.line}
                      className={`border-t border-outline-variant/50 ${
                        row.errors.length > 0
                          ? "bg-error/5"
                          : !row.instrumentExists
                          ? "bg-warning/5"
                          : row.duplicate
                          ? "bg-tertiary/5"
                          : ""
                      }`}
                    >
                      <td className="px-md py-sm">{row.fecha}</td>
                      <td className="px-md py-sm">
                        {row.instrumentExists ? (
                          <span className="text-on-surface">{row.instrumentName || row.ticker || row.isin}</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-warning">{row.ticker || row.isin}</span>
                            <button
                              onClick={() => {
                                setResolvingIndex(realIndex);
                                setSearchQuery(row.ticker || row.isin || row.nombre || "");
                                handleSearch(row.ticker || row.isin || row.nombre || "");
                              }}
                              className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded hover:bg-primary/30"
                            >
                              Resolver
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-md py-sm text-right font-mono">{row.titulos}</td>
                      <td className="px-md py-sm text-right font-mono">
                        {row.importeBrutoEur ? `${fmtEs(row.importeBrutoEur)} €` : "-"}
                      </td>
                      <td className="px-md py-sm text-right font-mono">
                        {row.retencionOrigenPct ? `${(row.retencionOrigenPct * 100).toFixed(0)}%` : "-"}
                      </td>
                      <td className="px-md py-sm text-right font-mono">
                        {row.retencionEspPct ? `${(row.retencionEspPct * 100).toFixed(0)}%` : "-"}
                      </td>
                      <td className="px-md py-sm text-right font-mono font-semibold">
                        {fmtEs(row.importeNetoEur)} €
                      </td>
                      <td className="px-md py-sm">
                        {row.errors.length > 0 ? (
                          <span className="text-error text-[11px]">{row.errors[0]}</span>
                        ) : !row.instrumentExists ? (
                          <span className="text-warning text-[11px]">No encontrado</span>
                        ) : row.duplicate ? (
                          <span className="text-tertiary text-[11px]">Duplicado</span>
                        ) : (
                          <span className="text-positive text-[11px]">OK</span>
                        )}
                      </td>
                      <td className="px-md py-sm">
                        {row.duplicate && (
                          <select
                            value={decision || ""}
                            onChange={(e) => resolveConflict(key, e.target.value as "skip" | "replace")}
                            className="text-[11px] bg-surface border border-outline-variant rounded px-1 py-0.5"
                          >
                            <option value="">Elegir...</option>
                            <option value="skip">Omitir</option>
                            <option value="replace">Reemplazar</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Import button */}
          <div className="flex justify-end gap-md">
            <button
              onClick={handleImport}
              disabled={loading || hasUnresolved || (hasDuplicates && unresolvedCount > 0)}
              className="bg-primary text-primary-on px-lg py-md rounded-lg text-label-caps hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Importando..." : `Importar ${filtered.filter((r) => r.errors.length === 0).length} dividendos`}
            </button>
          </div>
        </div>
      )}

      {/* Instrument resolution modal */}
      {resolvingIndex !== null && preview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-lg w-full max-w-lg mx-4 shadow-xl">
            <h3 className="text-body-lg font-semibold text-on-surface mb-md">
              Resolver instrumento: {preview[resolvingIndex].ticker || preview[resolvingIndex].isin}
            </h3>
            
            <div className="mb-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Buscar por ticker, ISIN o nombre..."
                className="w-full bg-surface-container-high rounded-lg px-md py-md text-body-md text-on-surface border border-outline-variant focus:border-primary focus:outline-none"
                autoFocus
              />
            </div>

            {searchLoading && <p className="text-body-sm text-on-surface-variant mb-md">Buscando...</p>}

            {searchResults.length > 0 && (
              <div className="mb-md max-h-60 overflow-y-auto border border-outline-variant rounded-lg">
                {searchResults.map((result, i) => (
                  <button
                    key={i}
                    onClick={() => resolveInstrument(resolvingIndex, result.ticker, result.name)}
                    className="w-full px-md py-sm text-left hover:bg-surface-container-low border-b border-outline-variant/30 last:border-b-0"
                  >
                    <div className="flex justify-between">
                      <span className="font-mono text-body-sm">{result.ticker}</span>
                      <span className={`text-[10px] px-1 rounded ${result.source === "local" ? "bg-primary/20 text-primary" : "bg-tertiary/20 text-tertiary"}`}>
                        {result.source}
                      </span>
                    </div>
                    <div className="text-body-sm text-on-surface-variant truncate">{result.name}</div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-md justify-between">
              <div className="flex gap-sm">
                <button
                  onClick={() => createInstrumentForRow(resolvingIndex, "STOCK")}
                  className="px-md py-sm bg-tertiary/20 text-tertiary rounded-lg text-body-sm hover:bg-tertiary/30"
                >
                  Crear como Stock
                </button>
                <button
                  onClick={() => createInstrumentForRow(resolvingIndex, "ETF")}
                  className="px-md py-sm bg-tertiary/20 text-tertiary rounded-lg text-body-sm hover:bg-tertiary/30"
                >
                  Crear como ETF
                </button>
              </div>
              <button
                onClick={() => {
                  setResolvingIndex(null);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="px-md py-sm bg-surface-container-high text-on-surface-variant rounded-lg text-body-sm hover:bg-surface-container-highest"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
