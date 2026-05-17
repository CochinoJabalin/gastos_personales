"use client";

import { useState, useEffect } from "react";
import ConditionalChip from "@/components/ConditionalChip";
import { parseSpanishNumber, formatSpanish, isIncome } from "@/lib/format";

interface Transaction {
  id: string;
  concept: string;
  amount: number;
  group: string;
  type: string;
  is_recurring: boolean;
  timestamp: string;
  bank_id: string;
  bank?: { id?: string; bank_name: string; account_label: string };
}

interface Bank {
  id: string;
  bank_name: string;
  account_label: string;
}

const CATEGORIES = [
  "Ingresos", "Ocio", "Compras", "JustEat", "Streaming",
  "Ropa", "Hogar", "Supermercado", "Transporte", "Salud",
  "Educación", "Servicios",
];
const TYPES = ["Fijo", "Variable"];

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ concept: "", amount: "", group: "", type: "", bank_id: "" });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    year: new Date().getFullYear().toString(),
    month: "",
    concept: "",
    group: "",
    type: "",
  });

  useEffect(() => {
    fetchBanks();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters.year, filters.month, filters.concept, filters.group, filters.type]);

  useEffect(() => {
    fetchTransactions();
  }, [page, filters]);

  function fetchBanks() {
    fetch("/api/banks").then(r => r.json()).then(setBanks).catch(() => {});
  }

  function fetchTransactions() {
    setLoading(true);
    const params = new URLSearchParams({ page: page.toString(), limit: "20" });
    if (filters.year) params.set("year", filters.year);
    if (filters.month) params.set("month", filters.month);
    if (filters.concept) params.set("concept", filters.concept);
    if (filters.group) params.set("group", filters.group);
    if (filters.type) params.set("type", filters.type);
    fetch(`/api/transactions?${params}`)
      .then(r => r.json())
      .then(data => {
        setTransactions(data.data || []);
        setTotalPages(data.totalPages || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function updateFilter(key: string, value: string) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  function startEdit(t: Transaction) {
    setEditingId(t.id);
    setEditForm({
      concept: t.concept,
      amount: t.amount.toString(),
      group: t.group,
      type: t.type,
      bank_id: t.bank_id || t.bank?.id || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ concept: "", amount: "", group: "", type: "", bank_id: "" });
  }

  async function saveEdit(id: string) {
    const amount = parseSpanishNumber(editForm.amount);
    const finalAmount = isIncome(editForm.group) ? Math.abs(amount) : -Math.abs(amount);

    await fetch(`/api/transactions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        concept: editForm.concept,
        amount: finalAmount,
        group: editForm.group,
        type: editForm.type,
        bank_id: editForm.bank_id,
      }),
    });
    setEditingId(null);
    fetchTransactions();
  }

  async function deleteTransaction(id: string) {
    if (!confirm("¿Eliminar esta transacción?")) return;
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    fetchTransactions();
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => (currentYear - 5 + i).toString());

  return (
    <div className="p-lg space-y-lg">
      <div className="flex justify-between items-center">
        <h1 className="text-headline-md text-on-surface">Todas las Operaciones</h1>
        <span className="text-body-sm text-on-surface-variant">
          Página {page} de {totalPages}
        </span>
      </div>

      <div className="flex flex-wrap gap-sm items-end bg-surface-container border border-outline-variant rounded-xl p-md">
        <div className="flex flex-col gap-xs">
          <label className="text-label-caps text-on-surface-variant">Año</label>
          <select
            value={filters.year}
            onChange={e => updateFilter("year", e.target.value)}
            className="bg-surface-container-high rounded px-2 py-1.5 text-body-sm text-on-surface border border-outline-variant"
          >
            <option value="">Todos</option>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-xs">
          <label className="text-label-caps text-on-surface-variant">Mes</label>
          <select
            value={filters.month}
            onChange={e => updateFilter("month", e.target.value)}
            className="bg-surface-container-high rounded px-2 py-1.5 text-body-sm text-on-surface border border-outline-variant"
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
        <div className="flex flex-col gap-xs">
          <label className="text-label-caps text-on-surface-variant">Concepto</label>
          <input
            type="text"
            value={filters.concept}
            onChange={e => updateFilter("concept", e.target.value)}
            placeholder="Buscar..."
            className="bg-surface-container-high rounded px-2 py-1.5 text-body-sm text-on-surface border border-outline-variant w-40"
          />
        </div>
        <div className="flex flex-col gap-xs">
          <label className="text-label-caps text-on-surface-variant">Categoría</label>
          <select
            value={filters.group}
            onChange={e => updateFilter("group", e.target.value)}
            className="bg-surface-container-high rounded px-2 py-1.5 text-body-sm text-on-surface border border-outline-variant"
          >
            <option value="">Todas</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-xs">
          <label className="text-label-caps text-on-surface-variant">Tipo</label>
          <select
            value={filters.type}
            onChange={e => updateFilter("type", e.target.value)}
            className="bg-surface-container-high rounded px-2 py-1.5 text-body-sm text-on-surface border border-outline-variant"
          >
            <option value="">Todos</option>
            {TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-high text-label-caps text-on-surface-variant">
                <th className="p-md">Fecha</th>
                <th className="p-md">Concepto</th>
                <th className="p-md">Banco</th>
                <th className="p-md">Categoría</th>
                <th className="p-md">Tipo</th>
                <th className="p-md text-right">Importe</th>
                <th className="p-md w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-lg text-center text-on-surface-variant">
                    Cargando...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-lg text-center text-on-surface-variant">
                    No hay transacciones
                  </td>
                </tr>
              ) : (
                transactions.map(t => (
                  <tr key={t.id} className="hover:bg-surface-container-low transition-colors">
                    {editingId === t.id ? (
                      <>
                        <td className="p-md text-on-surface-variant">
                          {new Date(t.timestamp).toLocaleDateString("es")}
                        </td>
                        <td className="p-md">
                          <input
                            value={editForm.concept}
                            onChange={e => setEditForm({...editForm, concept: e.target.value})}
                            className="bg-surface-container-high rounded px-2 py-1 text-body-sm text-on-surface border border-outline-variant"
                          />
                        </td>
                        <td className="p-md">
                          <select
                            value={editForm.bank_id}
                            onChange={e => setEditForm({...editForm, bank_id: e.target.value})}
                            className="bg-surface-container-high rounded px-2 py-1 text-body-sm text-on-surface border border-outline-variant"
                          >
                            <option value="">Seleccionar</option>
                            {banks.map(b => (
                              <option key={b.id} value={b.id}>{b.bank_name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-md">
                          <select
                            value={editForm.group}
                            onChange={e => setEditForm({...editForm, group: e.target.value})}
                            className="bg-surface-container-high rounded px-2 py-1 text-body-sm text-on-surface border border-outline-variant"
                          >
                            {CATEGORIES.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-md">
                          <select
                            value={editForm.type}
                            onChange={e => setEditForm({...editForm, type: e.target.value})}
                            className="bg-surface-container-high rounded px-2 py-1 text-body-sm text-on-surface border border-outline-variant"
                          >
                            {TYPES.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-md">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editForm.amount}
                            onChange={e => setEditForm({...editForm, amount: e.target.value})}
                            className="bg-surface-container-high rounded px-2 py-1 text-body-sm text-on-surface border border-outline-variant w-24 text-right"
                          />
                        </td>
                        <td className="p-md">
                          <div className="flex gap-1">
                            <button
                              onClick={() => saveEdit(t.id)}
                              className="text-primary hover:underline text-body-sm"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-on-surface-variant hover:text-on-surface text-body-sm"
                            >
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-md text-on-surface-variant">
                          {new Date(t.timestamp).toLocaleDateString("es")}
                        </td>
                        <td className="p-md text-on-surface font-medium">{t.concept}</td>
                        <td className="p-md text-on-surface-variant text-body-sm">
                          {t.bank?.bank_name || "-"}
                        </td>
                        <td className="p-md">
                          <ConditionalChip
                            label={t.group}
                            variant={t.group === "Ingresos" ? "success" : "warning"}
                          />
                        </td>
                        <td className="p-md">
                          <ConditionalChip
                            label={t.type}
                            variant={t.type === "Fijo" ? "info" : "warning"}
                          />
                        </td>
                        <td className={`p-md text-right font-mono ${Number(t.amount) < 0 ? "text-error" : "text-success"}`}>
                          {formatSpanish(Math.abs(Number(t.amount)))}€
                        </td>
                        <td className="p-md">
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEdit(t)}
                              className="text-primary hover:underline text-body-sm"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => deleteTransaction(t.id)}
                              className="text-error hover:underline text-body-sm"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-md">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-lg py-md bg-surface-container rounded-lg text-body-sm disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-lg py-md bg-surface-container rounded-lg text-body-sm disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}