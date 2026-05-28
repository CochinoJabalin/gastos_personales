"use client";

import { useState, useEffect } from "react";
import ConditionalChip from "@/components/ConditionalChip";
import ValueBlur from "@/components/ValueBlur";
import { useView } from "@/lib/ViewContext";
import { fmtEs, fmtDate } from "@/lib/format";

interface Account {
  id: string;
  account_label: string;
  bank: { bank_name: string };
  bank_id: string;
  balance: number;
}

interface Transfer {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  concept: string;
  timestamp: string;
  status: string;
  is_scheduled: boolean;
  frequency: string | null;
  next_run: string | null;
  last_run: string | null;
  end_date: string | null;
  enabled: boolean;
  from_account: { account_label: string; bank: { bank_name: string } };
  to_account: { account_label: string; bank: { bank_name: string } };
}

interface AutoTopupConfig {
  sourceBankName: string;
  targetBankName: string;
  threshold: number;
  amount: number;
  checkIntervalHours: number;
  enabled: boolean;
  lastCheck: string | null;
  nextRun: string | null;
}

interface TransferExecution {
  id: string;
  transfer_id: string;
  executed_at: string;
  scheduled_for: string | null;
  amount: number;
  from_balance_before: number;
  from_balance_after: number;
  to_balance_before: number;
  to_balance_after: number;
  status: string;
  error_message: string | null;
  from_account: {
    id: string;
    account_label: string;
    bank_name: string;
  };
  to_account: {
    id: string;
    account_label: string;
    bank_name: string;
  };
  concept: string;
  is_interest_payment: boolean;
  is_scheduled: boolean;
  frequency: string | null;
}

export default function TransfersPage() {
  const { hideValues, setHideValues } = useView();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [executions, setExecutions] = useState<TransferExecution[]>([]);
  const [autoTopup, setAutoTopup] = useState<AutoTopupConfig | null>(null);
  const [tab, setTab] = useState<"new" | "scheduled" | "pending" | "completed">("scheduled");

  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isScheduled, setIsScheduled] = useState(false);
  const [frequency, setFrequency] = useState("mensual");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [topupThreshold, setTopupThreshold] = useState("");
  const [topupAmount, setTopupAmount] = useState("");
  const [topupInterval, setTopupInterval] = useState("3");
  const [editingTopup, setEditingTopup] = useState(false);
  const [topupSaving, setTopupSaving] = useState(false);
  const [topupSaved, setTopupSaved] = useState(false);
  const [topupExecuting, setTopupExecuting] = useState(false);
  const [reversingId, setReversingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();
    fetchTransfers();
    fetchAutoTopupConfig();
    fetchExecutions();
  }, []);

  async function fetchAccounts() {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      setAccounts(data);
    } catch {}
  }

  async function fetchTransfers() {
    try {
      const res = await fetch("/api/transfers?limit=100");
      const data = await res.json();
      setTransfers(data.data || []);
    } catch {}
  }

  async function fetchExecutions() {
    try {
      const res = await fetch("/api/transfers/executions?months=2&limit=100");
      const data = await res.json();
      setExecutions(data.data || []);
    } catch {}
  }

  async function fetchAutoTopupConfig() {
    try {
      const res = await fetch("/api/auto-topup/config");
      const data = await res.json();
      setAutoTopup(data);
      setTopupThreshold(String(data.threshold));
      setTopupAmount(String(data.amount));
      setTopupInterval(String(data.checkIntervalHours));
    } catch {}
  }

  async function saveAutoTopupConfig() {
    setTopupSaving(true);
    try {
      const res = await fetch("/api/auto-topup/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threshold: parseFloat(topupThreshold.replace(",", ".")),
          amount: parseFloat(topupAmount.replace(",", ".")),
          checkIntervalHours: parseInt(topupInterval, 10),
          enabled: autoTopup?.enabled ?? true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAutoTopup(data);
        setTopupThreshold(String(data.threshold));
        setTopupAmount(String(data.amount));
        setTopupInterval(String(data.checkIntervalHours));
        setTopupSaved(true);
        setTimeout(() => setTopupSaved(false), 3000);
      }
    } finally {
      setTopupSaving(false);
    }
  }

  async function handleReverseExecution(execId: string) {
    if (!confirm("¿Revertir esta transferencia? Se ajustarán los balances de origen y destino.")) return;
    setReversingId(execId);
    try {
      const res = await fetch(`/api/transfers/executions/${execId}/reverse`, { method: "POST" });
      if (res.ok) {
        fetchExecutions();
        fetchTransfers();
      } else {
        const data = await res.json();
        alert(data.error || "Error al revertir");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setReversingId(null);
    }
  }

  async function handleExecuteTopup() {
    if (!autoTopup?.enabled) return;
    setTopupExecuting(true);
    try {
      const res = await fetch("/api/auto-topup/execute", { method: "POST" });
      if (res.ok) {
        fetchTransfers();
        fetchExecutions();
        fetchAutoTopupConfig();
      } else {
        const data = await res.json();
        alert(data.error || "Error al ejecutar el Auto-Topup");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setTopupExecuting(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const body: Record<string, unknown> = {
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount: parseFloat(amount.replace(",", ".")),
        concept: concept || undefined,
        timestamp: new Date(date + "T12:00:00").toISOString(),
        is_scheduled: isScheduled,
        frequency: isScheduled ? frequency : null,
        end_date: endDate ? new Date(endDate + "T12:00:00").toISOString() : null,
      };

      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Error al crear transferencia");
        return;
      }

      setSuccess(true);
      setFromAccountId("");
      setToAccountId("");
      setAmount("");
      setConcept("");
      setDate(new Date().toISOString().split("T")[0]);
      setIsScheduled(false);
      setFrequency("mensual");
      setEndDate("");
      fetchTransfers();
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecute = async (id: string) => {
    try {
      const res = await fetch(`/api/transfers/${id}/execute`, { method: "POST" });
      if (res.ok) {
        fetchTransfers();
        fetchExecutions();
      }
    } catch {}
  };

  const handleToggle = async (t: Transfer) => {
    try {
      await fetch(`/api/transfers/${t.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !t.enabled }),
      });
      fetchTransfers();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta transferencia?")) return;
    try {
      await fetch(`/api/transfers/${id}`, { method: "DELETE" });
      fetchTransfers();
    } catch {}
  };

  const pendingTransfers = transfers.filter(
    (t) => t.status === "pending" && (t.is_scheduled || new Date(t.timestamp) > new Date())
  );
  const completedTransfers = transfers.filter((t) => t.status === "completed");

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);

  return (
    <div className={`mx-auto py-lg space-y-lg ${tab === "scheduled" ? "max-w-5xl" : "max-w-2xl"} ${hideValues ? "hide-cifras" : ""}`}>
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {(["new", "scheduled", "pending", "completed"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-body-sm font-medium transition-colors ${
                tab === t
                  ? "bg-primary text-primary-on"
                  : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {t === "new" ? "Nueva" : t === "scheduled" ? "Programadas" : t === "pending" ? "Pendientes" : "Completadas"}
            </button>
          ))}
        </div>
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

      {tab === "new" && (
        <form
          onSubmit={handleSubmit}
          className="bg-surface-container-low border border-outline-variant rounded-xl p-lg space-y-lg"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
            <div className="space-y-xs">
              <label className="text-label-caps text-on-surface-variant uppercase">
                Cuenta Origen <span className="text-error">*</span>
              </label>
              <select
                value={fromAccountId}
                onChange={(e) => {
                  setFromAccountId(e.target.value);
                  if (e.target.value === toAccountId) setToAccountId("");
                }}
                className="w-full bg-surface-container-high rounded-lg px-md py-md text-body-md text-on-surface border-0 focus:ring-1 focus:ring-primary"
                required
              >
                <option value="">Seleccionar</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.bank.bank_name} - {a.account_label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-xs">
              <label className="text-label-caps text-on-surface-variant uppercase">
                Cuenta Destino <span className="text-error">*</span>
              </label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="w-full bg-surface-container-high rounded-lg px-md py-md text-body-md text-on-surface border-0 focus:ring-1 focus:ring-primary"
                required
              >
                <option value="">Seleccionar</option>
                {accounts
                  .filter((a) => a.id !== fromAccountId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bank.bank_name} - {a.account_label}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
            <div className="space-y-xs">
              <label className="text-label-caps text-on-surface-variant uppercase">
                Importe <span className="text-error">*</span>
              </label>
              <div className="bg-surface-container-lowest rounded-lg border border-outline-variant focus-within:border-primary transition-colors flex items-center">
                <span className="pl-md text-headline-md text-on-surface-variant">€</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-0 text-display-lg py-md text-primary"
                  placeholder="0,00"
                  required
                />
              </div>
            </div>
            <div className="space-y-xs">
              <label className="text-label-caps text-on-surface-variant uppercase">
                Fecha
              </label>
              <div className="bg-surface-container-lowest rounded-lg border border-outline-variant focus-within:border-primary transition-colors">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-0 text-body-md py-md px-md text-on-surface"
                />
              </div>
            </div>
          </div>

          <div className="space-y-xs">
            <label className="text-label-caps text-on-surface-variant uppercase">
              Concepto
            </label>
            <input
              type="text"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="w-full bg-surface-container-lowest rounded-lg border border-outline-variant px-md py-md text-body-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={
                fromAccount && toAccount
                  ? `Transferencia a ${toAccount.account_label}`
                  : "Descripción opcional..."
              }
            />
          </div>

          <div className="flex items-center gap-md">
            <label className="flex items-center gap-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isScheduled}
                onChange={(e) => setIsScheduled(e.target.checked)}
                className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary"
              />
              <span className="text-body-sm text-on-surface">Programar transferencia</span>
            </label>
          </div>

          {isScheduled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              <div className="space-y-xs">
                <label className="text-label-caps text-on-surface-variant uppercase">
                  Frecuencia
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full bg-surface-container-high rounded-lg px-md py-md text-body-md text-on-surface border-0 focus:ring-1 focus:ring-primary"
                >
                  <option value="mensual">Mensual</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
              <div className="space-y-xs">
                <label className="text-label-caps text-on-surface-variant uppercase">
                  Fecha Fin (opcional)
                </label>
                <div className="bg-surface-container-lowest rounded-lg border border-outline-variant focus-within:border-primary transition-colors">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-0 text-body-md py-md px-md text-on-surface"
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-error/10 text-error text-body-sm py-md px-md rounded-lg">
              {error}
            </div>
          )}

          {success ? (
            <div className="w-full bg-positive/20 text-positive text-body-md font-semibold py-md rounded-lg text-center">
              ✓ Transferencia creada
            </div>
          ) : (
            <button
              type="submit"
              disabled={submitting || !fromAccountId || !toAccountId || !amount}
              className="w-full bg-primary text-primary-on text-body-md font-semibold py-md rounded-lg active:scale-95 transition-transform shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {submitting
                ? "Creando..."
                : isScheduled
                  ? "Programar Transferencia"
                  : "Realizar Transferencia"}
            </button>
          )}
        </form>
      )}

      {tab === "scheduled" && (
        <>
        <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden w-full">
          <div className="overflow-x-auto">
            <table className="text-left w-full min-w-max">
              <thead>
                <tr className="bg-surface-container-high text-label-caps text-on-surface-variant">
                  <th className="p-md whitespace-nowrap">Origen</th>
                  <th className="p-md whitespace-nowrap">Destino</th>
                  <th className="p-md whitespace-nowrap">Importe</th>
                  <th className="p-md whitespace-nowrap">Frecuencia</th>
                  <th className="p-md whitespace-nowrap">Próxima ejecución</th>
                  <th className="p-md whitespace-nowrap">Estado</th>
                  <th className="p-md whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {autoTopup && (
                  <tr className="bg-surface-container-low">
                    <td className="p-md text-body-sm text-on-surface whitespace-nowrap">
                      {autoTopup.sourceBankName}
                    </td>
                    <td className="p-md text-body-sm text-on-surface whitespace-nowrap">
                      {autoTopup.targetBankName}
                    </td>
                    <td className="p-md whitespace-nowrap">
                      {editingTopup ? (
                        <div className="flex items-center gap-2">
                          <span className="text-body-xs text-on-surface-variant">Umbral:</span>
                          <div className="bg-surface-container-lowest rounded border border-outline-variant focus-within:border-primary transition-colors flex items-center w-[90px]">
                            <span className="pl-sm text-body-xs text-on-surface-variant">€</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={topupThreshold}
                              onChange={(e) => setTopupThreshold(e.target.value)}
                              className="w-full bg-transparent border-none focus:ring-0 text-body-sm py-0.5 text-primary"
                            />
                          </div>
                          <span className="text-body-xs text-on-surface-variant">Transf.:</span>
                          <div className="bg-surface-container-lowest rounded border border-outline-variant focus-within:border-primary transition-colors flex items-center w-[90px]">
                            <span className="pl-sm text-body-xs text-on-surface-variant">€</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={topupAmount}
                              onChange={(e) => setTopupAmount(e.target.value)}
                              className="w-full bg-transparent border-none focus:ring-0 text-body-sm py-0.5 text-primary"
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-body-sm text-on-surface font-medium">
                          <ValueBlur hidden={hideValues}>{fmtEs(autoTopup.amount, 2)} €</ValueBlur>
                        </span>
                      )}
                    </td>
                    <td className="p-md whitespace-nowrap">
                      {editingTopup ? (
                        <div className="flex items-center gap-1">
                          <span className="text-body-xs text-on-surface-variant">Cada</span>
                          <div className="bg-surface-container-lowest rounded border border-outline-variant focus-within:border-primary transition-colors flex items-center w-[50px]">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={topupInterval}
                              onChange={(e) => setTopupInterval(e.target.value)}
                              className="w-full bg-transparent border-none focus:ring-0 text-body-sm py-0.5 text-primary text-center"
                            />
                          </div>
                          <span className="text-body-xs text-on-surface-variant">h</span>
                        </div>
                      ) : (
                        <ConditionalChip label={`Cada ${autoTopup.checkIntervalHours}h`} variant="info" />
                      )}
                    </td>
                    <td className="p-md text-body-sm text-on-surface whitespace-nowrap">
                      {autoTopup.nextRun
                        ? new Date(autoTopup.nextRun).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
                        : autoTopup.lastCheck
                          ? new Date(autoTopup.lastCheck).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
                          : "Pendiente"}
                    </td>
                    <td className="p-md whitespace-nowrap">
                      <ConditionalChip
                        label={autoTopup.enabled ? "Activo" : "Inactivo"}
                        variant={autoTopup.enabled ? "success" : "warning"}
                      />
                    </td>
                    <td className="p-md">
                      <div className="flex gap-1 items-center">
                        {editingTopup ? (
                          <>
                            <button
                              onClick={() => { saveAutoTopupConfig(); setEditingTopup(false); }}
                              disabled={topupSaving}
                              className="px-2 py-1 bg-primary text-primary-on text-label-caps rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                              {topupSaving ? "..." : "Guardar"}
                            </button>
                            <button
                              onClick={() => { setEditingTopup(false); setTopupThreshold(String(autoTopup.threshold)); setTopupAmount(String(autoTopup.amount)); setTopupInterval(String(autoTopup.checkIntervalHours)); }}
                              className="px-2 py-1 text-label-caps rounded-md border border-outline-variant text-on-surface-variant hover:bg-surface-container-high transition-colors"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={handleExecuteTopup}
                              disabled={topupExecuting || !autoTopup.enabled}
                              className="px-2 py-1 bg-primary text-primary-on text-label-caps rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                              title="Ejecutar transferencia ahora"
                            >
                              {topupExecuting ? "..." : "Ejecutar"}
                            </button>
                            <button
                              onClick={() => setEditingTopup(true)}
                              className="px-2 py-1 bg-surface-container-high text-on-surface text-label-caps rounded-md hover:bg-surface-container-highest transition-colors border border-outline-variant"
                            >
                              Editar
                            </button>
                          </>
                        )}
                        <button
                          onClick={async () => {
                            await fetch("/api/auto-topup/config", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ enabled: !autoTopup.enabled }),
                            });
                            fetchAutoTopupConfig();
                          }}
                          className={`px-2 py-1 text-label-caps rounded-md border transition-colors ${
                            autoTopup.enabled
                              ? "border-warning text-warning hover:bg-warning/10"
                              : "border-positive text-positive hover:bg-positive/10"
                          }`}
                        >
                          {autoTopup.enabled ? "Desactivar" : "Activar"}
                        </button>
                        {topupSaved && (
                          <span className="text-positive text-body-xs font-medium">✓</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                {transfers.filter((t) => t.is_scheduled).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-lg text-center text-on-surface-variant text-body-sm">
                      No hay transferencias programadas
                    </td>
                  </tr>
                ) : (
                  transfers
                    .filter((t) => t.is_scheduled)
                    .sort((a, b) => {
                      if (!a.next_run) return 1;
                      if (!b.next_run) return -1;
                      return new Date(a.next_run).getTime() - new Date(b.next_run).getTime();
                    })
                    .map((t) => (
                      <tr key={t.id} className="hover:bg-surface-container-low transition-colors">
                        {t.from_account_id === t.to_account_id ? (
                          <td colSpan={2} className="p-md text-body-sm text-on-surface whitespace-nowrap">
                            <span className="flex items-center gap-xs text-positive">
                              <span className="material-symbols-outlined text-sm">savings</span>
                              Rendimientos — {t.to_account.bank.bank_name} - {t.to_account.account_label}
                            </span>
                          </td>
                        ) : (
                          <>
                            <td className="p-md text-body-sm text-on-surface whitespace-nowrap">
                              {t.from_account.bank.bank_name} - {t.from_account.account_label}
                            </td>
                            <td className="p-md text-body-sm text-on-surface whitespace-nowrap">
                              {t.to_account.bank.bank_name} - {t.to_account.account_label}
                            </td>
                          </>
                        )}
                        <td className="p-md text-body-sm text-on-surface font-medium whitespace-nowrap">
                          <ValueBlur hidden={hideValues}>
                            {fmtEs(t.amount, 2)} €{t.from_account_id === t.to_account_id && ` / ${t.frequency === "diario" ? "día" : "mes"}`}
                          </ValueBlur>
                        </td>
                        <td className="p-md whitespace-nowrap">
                          {t.frequency ? (
                            <ConditionalChip label={t.frequency} variant="info" />
                          ) : (
                            <span className="text-on-surface-variant text-body-sm">—</span>
                          )}
                        </td>
                        <td className="p-md text-body-sm text-on-surface whitespace-nowrap">
                          {t.next_run
                            ? t.frequency === "diario"
                              ? (() => {
                                  const d = new Date(t.next_run);
                                  const today = new Date();
                                  const isToday = d.toDateString() === today.toDateString();
                                  return `${isToday ? "Hoy" : "Mañana"}, ${d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`;
                                })()
                              : fmtDate(t.next_run)
                            : "—"}
                        </td>
                        <td className="p-md whitespace-nowrap">
                          <ConditionalChip
                            label={t.enabled ? "Activa" : "Pausada"}
                            variant={t.enabled ? "success" : "warning"}
                          />
                        </td>
                        <td className="p-md">
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleExecute(t.id)}
                              className="px-2 py-1 bg-primary text-primary-on text-label-caps rounded-md hover:opacity-90 transition-opacity"
                              title="Ejecutar ahora"
                            >
                              Ejecutar
                            </button>
                            <button
                              onClick={() => handleToggle(t)}
                              className={`px-2 py-1 text-label-caps rounded-md border transition-colors ${
                                t.enabled
                                  ? "border-warning text-warning hover:bg-warning/10"
                                  : "border-positive text-positive hover:bg-positive/10"
                              }`}
                              title={t.enabled ? "Pausar" : "Reanudar"}
                            >
                              {t.enabled ? "Pausar" : "Reanudar"}
                            </button>
                            <button
                              onClick={() => handleDelete(t.id)}
                              className="px-2 py-1 text-label-caps rounded-md border border-error text-error hover:bg-error/10 transition-colors"
                              title="Eliminar"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Historial de ejecuciones - últimos 2 meses + programadas */}
        <div className="mt-lg">
          <h3 className="text-headline-sm text-on-surface mb-md">Historial de Ejecuciones (últimos 2 meses + programadas)</h3>
          <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden w-full">
            <div className="overflow-x-auto">
              <table className="text-left w-full min-w-max">
                <thead>
                  <tr className="bg-surface-container-high text-label-caps text-on-surface-variant">
                    <th className="p-md whitespace-nowrap">Fecha/Hora</th>
                    <th className="p-md whitespace-nowrap">Origen</th>
                    <th className="p-md whitespace-nowrap">Destino</th>
                    <th className="p-md whitespace-nowrap">Importe</th>
                    <th className="p-md whitespace-nowrap">Saldo Destino (Antes)</th>
                    <th className="p-md whitespace-nowrap">Saldo Destino</th>
                    <th className="p-md whitespace-nowrap">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {executions.length === 0 ? (
                    <tr>
                        <td colSpan={7} className="p-lg text-center text-on-surface-variant text-body-sm">
                        No hay ejecuciones registradas
                      </td>
                    </tr>
                  ) : (
                    executions.map((exec) => {
                      const isScheduled = exec.status === "scheduled";
                      const displayDate = isScheduled && exec.scheduled_for ? exec.scheduled_for : exec.executed_at;
                      
                      return (
                        <tr 
                          key={exec.id} 
                          className={`transition-colors ${
                            isScheduled 
                              ? "bg-surface-container-low/50 hover:bg-surface-container-low" 
                              : "hover:bg-surface-container-low"
                          }`}
                        >
                          <td className="p-md text-body-sm whitespace-nowrap">
                            <span className={isScheduled ? "text-on-surface-variant" : "text-on-surface"}>
                              {fmtDate(displayDate)}
                            </span>{" "}
                            <span className="text-on-surface-variant">
                              {new Date(displayDate).toLocaleTimeString("es", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {isScheduled && (
                              <span className="ml-1 text-xs text-on-surface-variant">(prog.)</span>
                            )}
                          </td>
                          {exec.is_interest_payment ? (
                            <td colSpan={2} className="p-md text-body-sm whitespace-nowrap">
                              <span className={`flex items-center gap-xs ${isScheduled ? "text-positive/70" : "text-positive"}`}>
                                <span className="material-symbols-outlined text-sm">savings</span>
                                Rendimientos — {exec.from_account.bank_name} - {exec.from_account.account_label}
                              </span>
                            </td>
                          ) : (
                            <>
                              <td className={`p-md text-body-sm whitespace-nowrap ${isScheduled ? "text-on-surface-variant" : "text-on-surface"}`}>
                                {exec.from_account.bank_name} - {exec.from_account.account_label}
                              </td>
                              <td className={`p-md text-body-sm whitespace-nowrap ${isScheduled ? "text-on-surface-variant" : "text-on-surface"}`}>
                                {exec.to_account.bank_name} - {exec.to_account.account_label}
                              </td>
                            </>
                          )}
                          <td className={`p-md text-body-sm font-medium whitespace-nowrap ${isScheduled ? "text-on-surface-variant" : "text-on-surface"}`}>
                            {isScheduled ? "—" : (
                              <ValueBlur hidden={hideValues}>
                                {exec.is_interest_payment ? "+" : ""}{fmtEs(exec.amount, 2)} €
                              </ValueBlur>
                            )}
                          </td>
                          <td className="p-md text-body-sm text-on-surface-variant text-center whitespace-nowrap">
                            {isScheduled ? "—" : (
                              <ValueBlur hidden={hideValues}>{fmtEs(exec.to_balance_before, 2)} €</ValueBlur>
                            )}
                          </td>
                          <td className="p-md text-body-sm text-center whitespace-nowrap">
                            {isScheduled ? (
                              <span className="text-on-surface-variant">—</span>
                            ) : (
                              <ValueBlur hidden={hideValues}>
                                <span className="text-positive">
                                  {fmtEs(exec.to_balance_after, 2)} €
                                </span>
                              </ValueBlur>
                            )}
                          </td>
                          <td className="p-md whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <ConditionalChip
                                label={
                                  exec.status === "completed" 
                                    ? "Completada" 
                                    : exec.status === "scheduled" 
                                      ? "Programada" 
                                      : exec.status === "reversed"
                                        ? "Revertida"
                                        : "Error"
                                }
                                variant={
                                  exec.status === "completed" 
                                    ? "success" 
                                    : exec.status === "scheduled" 
                                      ? "info" 
                                      : exec.status === "reversed"
                                        ? "warning"
                                        : "critical"
                                }
                              />
                              {exec.status === "completed" && (
                                <button
                                  onClick={() => handleReverseExecution(exec.id)}
                                  disabled={reversingId === exec.id}
                                  className="p-1 rounded hover:bg-error/10 text-error disabled:opacity-30 transition-colors"
                                  title="Revertir transferencia"
                                >
                                  <span className="material-symbols-outlined text-sm">undo</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </>
      )}

      {tab === "pending" && (
        <div className="space-y-sm">
          {pendingTransfers.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant text-center py-lg">
              No hay transferencias pendientes
            </p>
          ) : (
            pendingTransfers.map((t) => (
              <div
                key={t.id}
                className="bg-surface-container-low border border-outline-variant rounded-xl p-lg space-y-md"
              >
                <div className="flex items-start justify-between gap-md">
                  <div className="min-w-0 flex-1 space-y-sm">
                    <p className="text-body-md font-semibold truncate">{t.concept}</p>
                    <div className="flex flex-wrap gap-xs">
                      <ConditionalChip
                        label={t.enabled ? "Activa" : "Pausada"}
                        variant={t.enabled ? "success" : "warning"}
                      />
                      {t.is_scheduled && (
                        <ConditionalChip label={t.frequency || ""} variant="info" />
                      )}
                    </div>
                    <div className="space-y-xs text-body-sm text-on-surface-variant">
                      <p>
                        <span className="text-on-surface">Desde:</span>{" "}
                        {t.from_account.bank.bank_name} -{" "}
                        {t.from_account.account_label}
                      </p>
                      <p>
                        <span className="text-on-surface">Hasta:</span>{" "}
                        {t.to_account.bank.bank_name} -{" "}
                        {t.to_account.account_label}
                      </p>
                      <p>
                        <span className="text-on-surface">Importe:</span>{" "}
                        <ValueBlur hidden={hideValues}>{fmtEs(t.amount, 2)} €</ValueBlur>
                      </p>
                      {t.next_run && (
                        <p>
                          <span className="text-on-surface">Próxima ejecución:</span>{" "}
                          {fmtDate(t.next_run)}
                        </p>
                      )}
                      {t.last_run && (
                        <p>
                          <span className="text-on-surface">Última ejecución:</span>{" "}
                          {fmtDate(t.last_run)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-sm flex-wrap">
                  <button
                    onClick={() => handleExecute(t.id)}
                    className="px-3 py-1.5 bg-primary text-primary-on text-body-sm rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Ejecutar ahora
                  </button>
                  <button
                    onClick={() => handleToggle(t)}
                    className={`px-3 py-1.5 text-body-sm rounded-lg border transition-colors ${
                      t.enabled
                        ? "border-warning text-warning hover:bg-warning/10"
                        : "border-positive text-positive hover:bg-positive/10"
                    }`}
                  >
                    {t.enabled ? "Pausar" : "Reanudar"}
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="px-3 py-1.5 text-body-sm rounded-lg border border-error text-error hover:bg-error/10 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "completed" && (
        <div className="space-y-sm">
          {completedTransfers.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant text-center py-lg">
              No hay transferencias completadas
            </p>
          ) : (
            completedTransfers.map((t) => (
              <div
                key={t.id}
                className="bg-surface-container-low border border-outline-variant rounded-xl p-lg"
              >
                <div className="flex items-start justify-between gap-md">
                  <div className="min-w-0 flex-1 space-y-sm">
                    <p className="text-body-md font-semibold truncate">{t.concept}</p>
                    <div className="flex flex-wrap gap-xs">
                      <ConditionalChip label="Completada" variant="success" />
                    </div>
                    <div className="space-y-xs text-body-sm text-on-surface-variant">
                      <p>
                        <span className="text-on-surface">Desde:</span>{" "}
                        {t.from_account.bank.bank_name} -{" "}
                        {t.from_account.account_label}
                      </p>
                      <p>
                        <span className="text-on-surface">Hasta:</span>{" "}
                        {t.to_account.bank.bank_name} -{" "}
                        {t.to_account.account_label}
                      </p>
                      <p>
                        <span className="text-on-surface">Importe:</span>{" "}
                        <ValueBlur hidden={hideValues}>{fmtEs(t.amount, 2)} €</ValueBlur>
                      </p>
                      <p>
                        <span className="text-on-surface">Fecha:</span>{" "}
                        {fmtDate(t.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
