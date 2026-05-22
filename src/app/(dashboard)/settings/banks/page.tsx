"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ValueBlur from "@/components/ValueBlur";
import { formatSpanish, fmtEs } from "@/lib/format";
import { formatIBAN } from "@/lib/iban";
import { useView } from "@/lib/ViewContext";

interface Account {
  id: string;
  account_label: string;
  iban?: string | null;
  balance: number;
  is_default: boolean;
  interest_rate: number;
  interest_period: string;
  last_interest_date?: string | null;
}

interface Bank {
  id: string;
  bank_name: string;
  account_label: string;
  iban?: string | null;
  balance: number;
  accounts: Account[];
}

export default function BanksSettingsPage() {
  const { hideValues, setHideValues } = useView();
  const pathname = usePathname();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);

  const subNavItems = [
    { href: "/settings", label: "General", icon: "settings" },
    { href: "/settings/banks", label: "Bancos", icon: "account_balance" },
    { href: "/settings/mapping-rules", label: "Mapeos", icon: "rule" },
    { href: "/settings/import", label: "Importar", icon: "upload" },
    { href: "/settings/backup", label: "Backup", icon: "backup" },
  ];

  // Add bank form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addIban, setAddIban] = useState("");
  const [addBalance, setAddBalance] = useState("");
  const [addError, setAddError] = useState("");

  // Add account form
  const [addAccountBankId, setAddAccountBankId] = useState<string | null>(null);
  const [addAccountLabel, setAddAccountLabel] = useState("");
  const [addAccountIban, setAddAccountIban] = useState("");
  const [addAccountBalance, setAddAccountBalance] = useState("");

  // Edit account inline
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editIban, setEditIban] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editPeriod, setEditPeriod] = useState("none");
  const [editBalance, setEditBalance] = useState("");

  // Delete
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  // Interest
  const [calcInterestId, setCalcInterestId] = useState<string | null>(null);
  const [calcInterestResult, setCalcInterestResult] = useState<string | null>(null);
  const [calcInterestLoading, setCalcInterestLoading] = useState(false);

  // Recalculate bank balances from accounts
  const [recalculating, setRecalculating] = useState(false);

  function fetchBanks() {
    setLoading(true);
    fetch("/api/banks")
      .then((r) => r.json())
      .then(setBanks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchBanks(); }, []);

  async function handleAddBank(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    const res = await fetch("/api/banks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bank_name: addName,
        account_label: addLabel,
        iban: addIban || null,
        balance: addBalance ? parseFloat(addBalance.replace(",", ".")) : 0,
      }),
    });
    if (res.ok) {
      setShowAddForm(false);
      setAddName(""); setAddLabel(""); setAddIban(""); setAddBalance("");
      fetchBanks();
    } else {
      const data = await res.json().catch(() => ({}));
      setAddError(data.error || `Error ${res.status}`);
    }
  }

  async function handleAddAccount(bankId: string) {
    if (!addAccountLabel.trim()) return;
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bank_id: bankId,
        account_label: addAccountLabel,
        iban: addAccountIban || null,
        balance: addAccountBalance ? parseFloat(addAccountBalance.replace(",", ".")) : 0,
      }),
    });
    setAddAccountBankId(null);
    setAddAccountLabel(""); setAddAccountIban(""); setAddAccountBalance("");
    fetchBanks();
  }

  function startEdit(acc: Account) {
    setEditAccountId(acc.id);
    setEditLabel(acc.account_label);
    setEditIban(acc.iban || "");
    setEditRate(acc.interest_rate.toString());
    setEditPeriod(acc.interest_period);
    setEditBalance(fmtEs(acc.balance, 2));
  }

  async function saveEdit() {
    if (!editAccountId) return;
    await fetch(`/api/accounts/${editAccountId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_label: editLabel,
        iban: editIban || null,
        interest_rate: parseFloat(editRate.replace(",", ".")) || 0,
        interest_period: editPeriod,
        balance: parseFloat(editBalance.replace(/\./g, "").replace(",", ".")) || 0,
      }),
    });
    setEditAccountId(null);
    fetchBanks();
  }

  async function handleDeleteAccount(accId: string) {
    setDeleteError("");
    const res = await fetch(`/api/accounts/${accId}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteAccountId(null);
      fetchBanks();
    } else {
      const data = await res.json().catch(() => ({}));
      setDeleteError(data.error || "Error al eliminar");
    }
  }

  async function setDefault(accId: string) {
    await fetch(`/api/accounts/${accId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    fetchBanks();
  }

  async function calcInterest(accId: string) {
    setCalcInterestLoading(true);
    setCalcInterestResult(null);
    setCalcInterestId(accId);
    try {
      const res = await fetch("/api/accounts/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accId }),
      });
      const data = await res.json();
      if (res.ok) {
        setCalcInterestResult(`Bruto: ${fmtEs(data.interest_gross)}€ · Ret. 19%: ${fmtEs(data.withholding)}€ · Neto: ${fmtEs(data.interest_net)}€`);
        fetchBanks();
      } else {
        setCalcInterestResult(`Error: ${data.error}`);
      }
    } catch {
      setCalcInterestResult("Error de conexión");
    } finally {
      setCalcInterestLoading(false);
    }
  }

  async function recalcAll() {
    setRecalculating(true);
    const res = await fetch("/api/accounts/migrate", { method: "POST" });
    if (res.ok) fetchBanks();
    setRecalculating(false);
  }

  const totalBalance = banks.reduce((sum, b) => sum + (b.balance || 0), 0);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="text-body-md text-on-surface-variant">Cargando...</div></div>;
  }

  return (
    <div className="space-y-lg">
      <div className="flex gap-2 border-b border-outline-variant pb-lg">
        {subNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/settings" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-lg py-md rounded-lg text-body-sm transition-colors ${
                isActive ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              }`}
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-md">
        <div>
          <h1 className="text-headline-md text-on-surface">Bancos</h1>
          <p className="text-body-sm text-on-surface-variant mt-xs">
            {banks.length} banco{banks.length !== 1 ? "s" : ""} · Balance total: <ValueBlur hidden={hideValues}>{formatSpanish(totalBalance)}€</ValueBlur>
          </p>
        </div>
        <div className="flex gap-sm">
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
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-sm bg-primary text-primary-on px-lg py-md rounded-lg text-label-caps hover:opacity-90"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Añadir banco
          </button>
          <button
            onClick={recalcAll}
            disabled={recalculating}
            className="flex items-center gap-sm bg-surface-container-high text-on-surface px-lg py-md rounded-lg text-label-caps hover:bg-surface-container-higher disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            Migrar cuentas
          </button>
        </div>
      </div>

      {/* Add Bank Form */}
      {showAddForm && (
        <form onSubmit={handleAddBank} className="bg-surface-container border border-outline-variant rounded-xl p-lg space-y-md">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-md">
            <input type="text" value={addName} onChange={e => setAddName(e.target.value)} placeholder="Nombre del banco" required
              className="bg-surface-container-lowest rounded-lg px-md py-md text-body-md text-on-surface border border-outline-variant focus:border-primary focus:outline-none" />
            <input type="text" value={addLabel} onChange={e => setAddLabel(e.target.value)} placeholder="Etiqueta cuenta principal" required
              className="bg-surface-container-lowest rounded-lg px-md py-md text-body-md text-on-surface border border-outline-variant focus:border-primary focus:outline-none" />
            <input type="text" value={addIban} onChange={e => setAddIban(e.target.value.toUpperCase())} placeholder="IBAN (opcional)"
              className="bg-surface-container-lowest rounded-lg px-md py-md text-body-md text-on-surface border border-outline-variant focus:border-primary focus:outline-none" />
            <input type="text" inputMode="decimal" value={addBalance} onChange={e => setAddBalance(e.target.value)} placeholder="Balance inicial (0,00)"
              className="bg-surface-container-lowest rounded-lg px-md py-md text-body-md text-on-surface border border-outline-variant focus:border-primary focus:outline-none" />
          </div>
          {addError && <p className="text-body-sm text-error">{addError}</p>}
          <div className="flex gap-sm justify-end">
            <button type="button" onClick={() => setShowAddForm(false)} className="text-body-sm text-on-surface-variant hover:text-on-surface px-lg py-md">Cancelar</button>
            <button type="submit" className="bg-primary text-primary-on px-lg py-md rounded-lg text-label-caps hover:opacity-90">Guardar banco</button>
          </div>
        </form>
      )}

      {/* Bank Cards */}
    <div className={`space-y-lg ${hideValues ? "hide-cifras" : ""}`}>
        {banks.length === 0 ? (
          <div className="text-center py-20 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl mb-4">account_balance</span>
            <p className="text-body-md">No hay bancos configurados</p>
          </div>
        ) : (
          banks.map((b) => (
            <div key={b.id} className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
              {/* Bank Header */}
              <div className="p-lg pb-0 flex items-center justify-between">
                <div className="flex items-center gap-md">
                  <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center">
                    <span className="material-symbols-outlined text-on-primary-container">account_balance</span>
                  </div>
                  <div>
                    <p className="text-body-md font-semibold text-on-surface">{b.bank_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-sm">
                  <p className={`text-data-mono font-mono ${b.balance >= 0 ? "text-success" : "text-error"}`}>
                    <ValueBlur hidden={hideValues}>{formatSpanish(b.balance)}€</ValueBlur>
                  </p>
                </div>
              </div>

              {/* Accounts */}
              <div className="px-lg pb-lg pt-md space-y-sm">
                {b.accounts.map((acc) => (
                  <div key={acc.id} className="bg-surface-container-high border border-outline-variant rounded-lg p-md">
                    {editAccountId === acc.id ? (
                      <div className="space-y-sm">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-sm">
                          <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)}
                            placeholder="Nombre"
                            className="bg-surface-container-lowest rounded px-2 py-1 text-body-sm text-on-surface border border-outline-variant" />
                          <input type="text" value={editIban} onChange={e => setEditIban(e.target.value.toUpperCase())}
                            placeholder="IBAN (opcional)"
                            className="bg-surface-container-lowest rounded px-2 py-1 text-body-sm text-on-surface border border-outline-variant font-mono" />
                          <input type="text" inputMode="decimal" value={editBalance} onChange={e => setEditBalance(e.target.value)}
                            placeholder="Balance"
                            className="bg-surface-container-lowest rounded px-2 py-1 text-body-sm text-on-surface border border-outline-variant font-mono" />
                          <div className="flex gap-sm items-center">
                            <input type="text" inputMode="decimal" value={editRate} onChange={e => setEditRate(e.target.value)} placeholder="% interés anual"
                              className="bg-surface-container-lowest rounded px-2 py-1 text-body-sm text-on-surface border border-outline-variant w-20" />
                            <select value={editPeriod} onChange={e => setEditPeriod(e.target.value)}
                              className="bg-surface-container-lowest rounded px-2 py-1 text-body-sm text-on-surface border border-outline-variant">
                              <option value="none">Sin interés</option>
                              <option value="monthly">Mensual</option>
                              <option value="daily">Diario</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-sm pt-xs">
                          <button onClick={saveEdit} className="bg-primary text-primary-on px-md py-sm rounded text-label-caps text-[11px]">Guardar</button>
                          <button onClick={() => setEditAccountId(null)} className="text-on-surface-variant hover:text-on-surface text-body-sm">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-md min-w-0">
                          <div>
                            <div className="flex items-center gap-sm">
                              <p className="text-body-sm font-semibold text-on-surface">{acc.account_label}</p>
                              {acc.is_default && (
                                <span className="bg-primary-container text-on-primary-container text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">Default</span>
                              )}
                            </div>
                            {acc.iban && <p className="text-label-xs text-on-surface-variant/60 font-mono">{formatIBAN(acc.iban)}</p>}
                            {(Number(acc.interest_rate) > 0) && (
                              <p className="text-label-xs text-primary mt-xs">
                                {acc.interest_rate}% {acc.interest_period === "daily" ? "diario" : "mensual"}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-md shrink-0">
                          <p className={`text-data-mono font-mono ${acc.balance >= 0 ? "text-success" : "text-error"}`}>
                            <ValueBlur hidden={hideValues}>{formatSpanish(acc.balance)}€</ValueBlur>
                          </p>
                          <div className="flex gap-xs">
                            {!acc.is_default && (
                              <button onClick={() => setDefault(acc.id)} className="p-1 text-on-surface-variant hover:text-primary" title="Establecer como default">
                                <span className="material-symbols-outlined text-lg">star</span>
                              </button>
                            )}
                            <button onClick={() => startEdit(acc)} className="p-1 text-on-surface-variant hover:text-on-surface" title="Editar cuenta">
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            {Number(acc.interest_rate) > 0 && acc.interest_period !== "none" && (
                              <button
                                onClick={() => calcInterest(acc.id)}
                                disabled={calcInterestLoading && calcInterestId === acc.id}
                                className="p-1 text-primary hover:text-primary" title="Calcular intereses"
                              >
                                <span className="material-symbols-outlined text-lg">percent</span>
                              </button>
                            )}
                            {deleteAccountId === acc.id ? (
                              <div className="flex items-center gap-xs">
                                <button onClick={() => handleDeleteAccount(acc.id)} className="text-error hover:underline text-body-sm">Confirmar</button>
                                <button onClick={() => { setDeleteAccountId(null); setDeleteError(""); }} className="text-on-surface-variant hover:text-on-surface text-body-sm">Cancelar</button>
                              </div>
                            ) : (
                              <button onClick={() => setDeleteAccountId(acc.id)} className="p-1 text-on-surface-variant hover:text-error" title="Eliminar cuenta">
                                <span className="material-symbols-outlined text-lg">delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {calcInterestId === acc.id && calcInterestResult && (
                      <div className={`mt-sm text-body-sm ${calcInterestResult.startsWith("Error") ? "text-error" : "text-success"}`}>
                        {calcInterestResult}
                      </div>
                    )}

                    {deleteAccountId === acc.id && deleteError && (
                      <div className="mt-sm text-body-sm text-error">{deleteError}</div>
                    )}
                  </div>
                ))}

                {addAccountBankId === b.id ? (
                  <div className="bg-surface-container-high border border-dashed border-outline-variant rounded-lg p-md space-y-sm">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-sm">
                      <input type="text" value={addAccountLabel} onChange={e => setAddAccountLabel(e.target.value)} placeholder="Nombre de la cuenta" required
                        className="bg-surface-container-lowest rounded px-2 py-1 text-body-sm text-on-surface border border-outline-variant" />
                      <input type="text" value={addAccountIban} onChange={e => setAddAccountIban(e.target.value.toUpperCase())}
                        placeholder={b.iban ? `IBAN (por defecto: ${formatIBAN(b.iban)})` : "IBAN (opcional)"}
                        className="bg-surface-container-lowest rounded px-2 py-1 text-body-sm text-on-surface border border-outline-variant font-mono" />
                      <input type="text" inputMode="decimal" value={addAccountBalance} onChange={e => setAddAccountBalance(e.target.value)} placeholder="Balance inicial"
                        className="bg-surface-container-lowest rounded px-2 py-1 text-body-sm text-on-surface border border-outline-variant" />
                    </div>
                    <div className="flex gap-sm justify-end">
                      <button onClick={() => handleAddAccount(b.id)} className="bg-primary text-primary-on px-md py-sm rounded text-label-caps text-[11px]">Guardar cuenta</button>
                      <button onClick={() => { setAddAccountBankId(null); setAddAccountLabel(""); setAddAccountIban(""); setAddAccountBalance(""); }}
                        className="text-on-surface-variant hover:text-on-surface text-body-sm">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddAccountBankId(b.id)}
                    className="flex items-center gap-sm text-primary hover:underline text-body-sm pt-sm"
                  >
                    <span className="material-symbols-outlined text-lg">add</span>
                    Añadir cuenta
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
