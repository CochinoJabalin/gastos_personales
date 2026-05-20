"use client";

import { useState } from "react";
import { formatSpanish } from "@/lib/format";

interface PreviewRow {
  line: number; dateStr: string; date: string; bankName: string;
  concept: string; comments: string | null; amount: number;
  group: string; type: string;
  duplicate: { id: string; concept: string; amount: number; date: string } | null;
}

export default function TransactionsImport() {
  const [separator, setSeparator] = useState(";");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [conflicts, setConflicts] = useState<Record<string, "keep" | "replace">>({});
  const [applyAll, setApplyAll] = useState<"keep" | "replace" | null>(null);
  const [yearFilter, setYearFilter] = useState<string[]>([]);
  const [monthFilter, setMonthFilter] = useState("");
  const [result, setResult] = useState<{ created: number; replaced: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");
  const [pendingBanks, setPendingBanks] = useState<string[] | null>(null);
  const [creatingBanks, setCreatingBanks] = useState(false);

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError("");
    setPreview(null);
    setResult(null);
    setConflicts({});
    setApplyAll(null);
    setPendingBanks(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("separator", separator);

    try {
      const res = await fetch("/api/transactions/import/preview", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error del servidor");
      } else if (data.pending_banks?.length > 0) {
        setPendingBanks(data.pending_banks);
      } else {
        setPreview(data.rows);
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  const filtered = preview
    ? preview.filter((r) => {
        const [y, m] = r.date.split("-");
        if (yearFilter.length > 0 && !yearFilter.includes(y)) return false;
        if (monthFilter && m !== monthFilter.padStart(2, "0")) return false;
        return true;
      })
    : [];

  const availableYears = preview
    ? [...new Set(preview.map((r) => r.date.split("-")[0]))].sort()
    : [];

  function resolveConflict(key: string, decision: "keep" | "replace") {
    setConflicts((prev) => ({ ...prev, [key]: decision }));
  }

  function resolveAll(decision: "keep" | "replace") {
    setApplyAll(decision);
    const next: Record<string, "keep" | "replace"> = {};
    for (const r of filtered) {
      if (r.duplicate) {
        next[`${r.concept}|${r.date}`] = decision;
      }
    }
    setConflicts(next);
  }

  async function handleImport() {
    setLoading(true);
    setError("");
    setResult(null);

    const items = filtered.map((r) => {
      const key = `${r.concept}|${r.date}`;
      const decision = r.duplicate ? (conflicts[key] || "keep") : "create";
      const [y, m, d] = r.date.split("-").map(Number);
      return {
        action: decision === "replace" ? ("replace" as const) : ("create" as const),
        duplicateId: r.duplicate?.id,
        dateStr: r.dateStr,
        bankName: r.bankName,
        concept: r.concept,
        comments: r.comments,
        amount: r.amount,
        group: r.group,
        type: r.type,
        yearNum: y,
        monthIdx: m - 1,
        day: d,
      };
    });

    try {
      const res = await fetch("/api/transactions/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error del servidor");
      } else if (data.phase === "banks_pending") {
        setPendingBanks(data.pending_banks);
      } else {
        setResult(data);
        setPreview(null);
        setFile(null);
        setConflicts({});
        setApplyAll(null);
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  const hasDuplicates = filtered.some((r) => r.duplicate);
  const unresolved = filtered.some((r) => r.duplicate && !conflicts[`${r.concept}|${r.date}`]);

  return (
    <div>
      <div className="flex gap-md mb-lg">
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

      {pendingBanks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !creatingBanks && setPendingBanks(null)}>
          <div className="bg-surface-container border border-outline-variant rounded-xl p-xl w-full max-w-lg mx-md space-y-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-title-md text-on-surface">Bancos no registrados</h3>
              <button onClick={() => !creatingBanks && setPendingBanks(null)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-body-sm text-on-surface-variant">
              Los siguientes bancos no existen. Asígnale una cuenta para crearlos automáticamente:
            </p>
            <div className="space-y-md">
              {pendingBanks.map((bankName) => (
                <div key={bankName} className="bg-surface-container-high rounded-lg p-md space-y-sm">
                  <label className="text-label-caps text-on-surface-variant uppercase block">Nombre del banco</label>
                  <input
                    readOnly
                    value={bankName}
                    className="w-full bg-surface-container rounded-lg px-md py-md text-body-md text-on-surface border border-outline-variant"
                  />
                  <div className="grid grid-cols-2 gap-sm">
                    <div>
                      <label className="text-label-caps text-on-surface-variant uppercase block mb-1">Cuenta</label>
                      <input
                        id={`account-${bankName}`}
                        defaultValue={`Cuenta ${bankName}`}
                        className="w-full bg-surface-container rounded-lg px-md py-md text-body-md text-on-surface border border-outline-variant focus:border-primary focus:outline-none"
                        placeholder="Cuenta Principal"
                      />
                    </div>
                    <div>
                      <label className="text-label-caps text-on-surface-variant uppercase block mb-1">IBAN (opcional)</label>
                      <input
                        id={`iban-${bankName}`}
                        className="w-full bg-surface-container rounded-lg px-md py-md text-body-md text-on-surface border border-outline-variant focus:border-primary focus:outline-none"
                        placeholder="ES00..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={async () => {
                setCreatingBanks(true);
                try {
                  for (const bankName of pendingBanks) {
                    const accountLabel = (document.getElementById(`account-${bankName}`) as HTMLInputElement).value || `Cuenta ${bankName}`;
                    const iban = (document.getElementById(`iban-${bankName}`) as HTMLInputElement).value || undefined;
                    const res = await fetch("/api/banks", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ bank_name: bankName, account_label: accountLabel, iban }),
                    });
                    if (!res.ok) {
                      const data = await res.json();
                      setError(data.error || `Error al crear banco: ${bankName}`);
                      setPendingBanks(null);
                      setCreatingBanks(false);
                      return;
                    }
                  }
                  setPendingBanks(null);
                  await handlePreview();
                } catch {
                  setError("Error de conexión al crear bancos");
                  setPendingBanks(null);
                } finally {
                  setCreatingBanks(false);
                }
              }}
              disabled={creatingBanks}
              className="w-full bg-primary text-primary-on py-md rounded-lg text-label-caps hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {creatingBanks ? "Creando bancos..." : `Crear ${pendingBanks.length} banco(s) y continuar`}
            </button>
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
                        prev.includes(y)
                          ? prev.filter((v) => v !== y)
                          : [...prev, y]
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
            <div>
              <label className="text-label-caps text-on-surface-variant uppercase block mb-1">Mes</label>
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="bg-surface-container-high rounded-lg px-md py-md text-body-md text-on-surface border border-outline-variant"
              >
                <option value="">Todos</option>
                {[
                  ["Enero", "1"], ["Febrero", "2"], ["Marzo", "3"], ["Abril", "4"],
                  ["Mayo", "5"], ["Junio", "6"], ["Julio", "7"], ["Agosto", "8"],
                  ["Septiembre", "9"], ["Octubre", "10"], ["Noviembre", "11"], ["Diciembre", "12"],
                ].map(([label, value]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <span className="text-body-sm text-on-surface-variant">
              {filtered.length} de {preview.length} filas
            </span>
          </div>

          {hasDuplicates && (
            <div className="bg-warning-container/20 border border-warning/30 rounded-xl p-md">
              <div className="flex items-center justify-between mb-sm">
                <p className="text-body-sm font-semibold text-warning">
                  Se detectaron {filtered.filter((r) => r.duplicate).length} duplicados
                </p>
                <div className="flex gap-sm">
                  <button
                    onClick={() => resolveAll("keep")}
                    className={`px-md py-sm rounded-lg text-label-caps transition-colors ${
                      applyAll === "keep"
                        ? "bg-primary-container text-on-primary-container"
                        : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                    }`}
                  >
                    Mantener todos
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

          <div className="max-h-64 overflow-y-auto border border-outline-variant rounded-lg">
            <table className="w-full text-left text-data-mono">
              <thead>
                <tr className="bg-surface-container-high text-on-surface-variant sticky top-0">
                  <th className="py-sm px-2 text-label-caps">Fecha</th>
                  <th className="py-sm px-2 text-label-caps">Concepto</th>
                  <th className="py-sm px-2 text-label-caps text-right">Importe</th>
                  <th className="py-sm px-2 text-label-caps">Categoría</th>
                  <th className="py-sm px-2 text-label-caps">Tipo</th>
                  {hasDuplicates && <th className="py-sm px-2 text-label-caps">Conflicto</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filtered.map((r, i) => {
                  const key = `${r.concept}|${r.date}`;
                  const resolution = conflicts[key];
                  return (
                    <tr key={i} className={`hover:bg-surface-container-high transition-colors ${
                      r.duplicate && !resolution ? "bg-warning-container/10" : ""
                    }`}>
                      <td className="py-md px-2 text-on-surface-variant whitespace-nowrap">{r.dateStr}</td>
                      <td className="py-md px-2 text-on-surface">{r.concept}</td>
                      <td className={`py-md px-2 text-right ${r.amount < 0 ? "text-error" : "text-success"}`}>
                        {formatSpanish(Math.abs(r.amount))}€
                      </td>
                      <td className="py-md px-2 text-on-surface">{r.group}</td>
                      <td className="py-md px-2 text-on-surface">{r.type}</td>
                      {hasDuplicates && (
                        <td className="py-md px-2">
                          {r.duplicate ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => resolveConflict(key, "keep")}
                                className={`px-2 py-0.5 rounded text-label-caps text-[10px] transition-colors ${
                                  resolution === "keep"
                                    ? "bg-primary text-primary-on"
                                    : "bg-surface-container-high text-on-surface-variant hover:bg-primary/20"
                                }`}
                              >
                                Mantener
                              </button>
                              <button
                                onClick={() => resolveConflict(key, "replace")}
                                className={`px-2 py-0.5 rounded text-label-caps text-[10px] transition-colors ${
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
              disabled={loading || unresolved}
              className="w-full bg-primary text-primary-on py-md rounded-lg text-label-caps hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading
                ? "Importando..."
                : unresolved
                  ? `Resuelve ${filtered.filter((r) => r.duplicate && !conflicts[`${r.concept}|${r.date}`]).length} conflicto(s) pendientes`
                  : `Importar ${filtered.length} filas`
              }
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="mt-md space-y-1">
          <p className="text-body-sm text-primary">
            {result.created} creadas, {result.replaced} reemplazadas
          </p>
          {result.errors?.map((err, i) => (
            <p key={i} className="text-body-sm text-error">{err}</p>
          ))}
        </div>
      )}
    </div>
  );
}
