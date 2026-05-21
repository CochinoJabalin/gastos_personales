"use client";

import { useState, useEffect } from "react";
import ConditionalChip from "@/components/ConditionalChip";

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

export default function TransfersPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [tab, setTab] = useState<"new" | "pending" | "completed">("new");

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

  useEffect(() => {
    fetchAccounts();
    fetchTransfers();
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
    <div className="max-w-2xl mx-auto py-lg space-y-lg">
      {/* Tabs */}
      <div className="flex gap-2">
        {(["new", "pending", "completed"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-body-sm font-medium transition-colors ${
              tab === t
                ? "bg-primary text-primary-on"
                : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t === "new" ? "Nueva" : t === "pending" ? "Pendientes" : "Completadas"}
          </button>
        ))}
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
                        {t.amount.toLocaleString("es", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        €
                      </p>
                      {t.next_run && (
                        <p>
                          <span className="text-on-surface">Próxima ejecución:</span>{" "}
                          {new Date(t.next_run).toLocaleDateString("es")}
                        </p>
                      )}
                      {t.last_run && (
                        <p>
                          <span className="text-on-surface">Última ejecución:</span>{" "}
                          {new Date(t.last_run).toLocaleDateString("es")}
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
                        {t.amount.toLocaleString("es", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        €
                      </p>
                      <p>
                        <span className="text-on-surface">Fecha:</span>{" "}
                        {new Date(t.timestamp).toLocaleDateString("es")}
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
