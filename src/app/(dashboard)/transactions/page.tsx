"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ConditionalChip from "@/components/ConditionalChip";
import ConceptCombobox from "@/components/ConceptCombobox";
import ValueBlur from "@/components/ValueBlur";
import { parseSpanishNumber, formatSpanish, isIncome, fmtDate } from "@/lib/format";
import { useView } from "@/lib/ViewContext";

interface Transaction {
  id: string;
  concept: string;
  amount: number;
  group: string;
  type: string;
  is_recurring: boolean;
  timestamp: string;
  bank_id: string;
  comentarios?: string | null;
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

const CATEGORY_MAP: Record<string, string> = {
  "Ingresos Varios": "Ingresos",
  "Ingresos Nomina": "Ingresos",
  "Ingresos Entrepeñas": "Ingresos",
  "Ingresos Transferencias": "Ingresos",
  "Gastos Comida": "Supermercado",
  "Gastos Ocio": "Ocio",
  "Gastos Compras": "Compras",
  "Gastos Justeat": "JustEat",
  "Gastos Streaming": "Streaming",
  "Gastos Ropa": "Ropa",
  "Gastos Hogar": "Hogar",
  "Gastos Transporte": "Transporte",
  "Gastos Salud": "Salud",
  "Gastos Educación": "Educación",
  "Gastos Servicios": "Servicios",
  "Gastos Varios": "Ocio",
  "Gastos Coche": "Transporte",
  "Gastos Comunidad": "Servicios",
  "Gastos Impuestos": "Servicios",
  "Gastos Telefonia": "Servicios",
  "Gastos Seguros": "Servicios",
  "Gastos Formacion": "Educación",
  "Gastos Medicos": "Salud",
  "Gastos Vacaciones": "Ocio",
  "Hipoteca": "Servicios",
  "Ahorro": "Ingresos",
  "myinvestor": "Ingresos",
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ concept: "", amount: "", group: "", type: "", bank_id: "", comentarios: "", timestamp: "" });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showFuture, setShowFuture] = useState(false);

  const [years, setYears] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tab, setTab] = useState<"transactions" | "categories">("transactions");
  const [groups, setGroups] = useState<{ group: string; type: string; count: number }[]>([]);
  const [editingGroup, setEditingGroup] = useState<{ oldGroup: string; newGroup: string; newType: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchModal, setBatchModal] = useState<{ field: string; open: boolean }>({ field: "", open: false });
  const [batchValue, setBatchValue] = useState("");
  const { hideValues, setHideValues } = useView();
  const originalConceptRef = useRef("");

  const [catFilters, setCatFilters] = useState({
    category: "",
    type: "",
  });
  const [catGroups, setCatGroups] = useState<{ group: string; type: string; count: number }[]>([]);
  const [migratingGroup, setMigratingGroup] = useState<string | null>(null);
  const [migrateTarget, setMigrateTarget] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<{ group: string; type: string } | null>(null);
  const [categoryTransactions, setCategoryTransactions] = useState<Transaction[]>([]);
  const [loadingCatTx, setLoadingCatTx] = useState(false);

  const [filters, setFilters] = useState({
    year: new Date().getFullYear().toString(),
    month: "",
    concept: "",
    group: "",
    type: "",
  });

  useEffect(() => {
    fetchBanks();
    fetchYears();
    fetch("/api/categories")
      .then(r => r.json())
      .then(setCategories)
      .catch(() => {});
    fetchGroups();
  }, []);

  function fetchGroups() {
    fetch("/api/transactions/groups")
      .then(r => r.json())
      .then(setGroups)
      .catch(() => {});
  }

  function fetchCatGroups() {
    const params = new URLSearchParams();
    if (catFilters.category) params.set("category", catFilters.category);
    if (catFilters.type) params.set("type", catFilters.type);
    const qs = params.toString();
    fetch(`/api/transactions/groups${qs ? `?${qs}` : ""}`)
      .then(r => r.json())
      .then(setCatGroups)
      .catch(() => {});
  }

  async function handleCategoryClick(g: { group: string; type: string }) {
    setSelectedCategory(g);
    setLoadingCatTx(true);
    setCategoryTransactions([]);
    try {
      const res = await fetch(`/api/transactions?group=${encodeURIComponent(g.group)}&type=${encodeURIComponent(g.type)}&limit=1000`);
      const data = await res.json();
      setCategoryTransactions(data.data || []);
    } catch {
      setCategoryTransactions([]);
    }
    setLoadingCatTx(false);
  }

  useEffect(() => {
    setPage(1);
  }, [filters.year, filters.month, filters.concept, filters.group, filters.type, showFuture]);

  useEffect(() => {
    if (years.length > 0 && !filters.year) {
      setFilters(prev => ({ ...prev, year: years[years.length - 1] }));
    }
  }, [years]);

  useEffect(() => {
    fetchTransactions();
  }, [page, filters, showFuture]);

  useEffect(() => {
    fetchCatGroups();
  }, [catFilters]);

  function fetchBanks() {
    fetch("/api/banks").then(r => r.json()).then(setBanks).catch(() => {});
  }

  function fetchYears() {
    fetch("/api/transactions/years").then(r => r.json()).then(data => {
      setYears(data.years || []);
    }).catch(() => {});
  }

  function fetchTransactions() {
    setLoading(true);
    const params = new URLSearchParams({ page: page.toString(), limit: "100" });
    if (filters.year) params.set("year", filters.year);
    if (filters.month) params.set("month", filters.month);
    if (filters.concept) params.set("concept", filters.concept);
    if (filters.group) params.set("group", filters.group);
    if (filters.type) params.set("type", filters.type);
    if (showFuture) params.set("future", "true");
    fetch(`/api/transactions?${params}`)
      .then(r => r.json())
      .then(data => {
        setTransactions(data.data || []);
        setTotalPages(data.totalPages || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  const inferEditConcept = useCallback(async (text: string) => {
    if (!text || text.length < 2) return;
    try {
      const res = await fetch("/api/infer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept: text }),
      });
      const result = await res.json();
      if (result && result.group) {
        const mappedGroup = CATEGORY_MAP[result.group] || result.group;
        setEditForm(prev => ({
          ...prev,
          group: mappedGroup,
          type: result.type || prev.type,
        }));
      }
    } catch {
      // ignore inference errors
    }
  }, []);

  useEffect(() => {
    if (!editingId) return;
    if (editForm.concept === originalConceptRef.current) return;
    const timer = setTimeout(() => inferEditConcept(editForm.concept), 400);
    return () => clearTimeout(timer);
  }, [editForm.concept, editingId, inferEditConcept]);

  function updateFilter(key: string, value: string) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  function startEdit(t: Transaction) {
    setEditingId(t.id);
    originalConceptRef.current = t.concept;
    setEditForm({
      concept: t.concept,
      amount: t.amount.toString(),
      group: t.group,
      type: t.type,
      bank_id: t.bank_id || t.bank?.id || "",
      comentarios: t.comentarios || "",
      timestamp: new Date(t.timestamp).toISOString().split("T")[0],
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ concept: "", amount: "", group: "", type: "", bank_id: "", comentarios: "", timestamp: "" });
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
        comentarios: editForm.comentarios || null,
        timestamp: editForm.timestamp ? new Date(editForm.timestamp + "T12:00:00").toISOString() : undefined,
      }),
    });
    setEditingId(null);
    fetchTransactions();
  }

  async function deleteTransaction(id: string) {
    if (!confirm("¿Eliminar esta transacción?")) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Error al eliminar la transacción");
      return;
    }
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    fetchTransactions();
    fetchGroups();
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`¿Eliminar ${selectedIds.size} transacciones seleccionadas?`)) return;
    for (const id of selectedIds) {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        alert(`Error al eliminar transacción ${id}`);
        break;
      }
    }
    setSelectedIds(new Set());
    fetchTransactions();
    fetchGroups();
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map(t => t.id)));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setBatchModal({ field: "", open: false });
    setBatchValue("");
  }

  async function handleBatchUpdate() {
    if (selectedIds.size === 0 || !batchModal.field || !batchValue) return;

    await fetch("/api/transactions/batch-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: Array.from(selectedIds),
        data: { [batchModal.field]: batchValue },
      }),
    });

    setSelectedIds(new Set());
    setBatchModal({ field: "", open: false });
    setBatchValue("");
    fetchTransactions();
  }

  return (
    <div className={`p-lg space-y-lg ${hideValues ? "hide-cifras" : ""}`}>
      <div className="flex justify-between items-center">
        <h1 className="text-headline-md text-on-surface">
          {showFuture ? "Operaciones Futuras" : "Todas las Operaciones"}
        </h1>
        <div className="flex items-center gap-md">
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
            onClick={() => setShowFuture(!showFuture)}
            className="px-lg py-md bg-tertiary-container text-on-tertiary-container rounded-lg text-body-sm"
          >
            {showFuture ? "Ver Operaciones Pasadas" : "Ver Operaciones Futuras"}
          </button>
          {tab === "transactions" && (
            <span className="text-body-sm text-on-surface-variant">
              Página {page} de {totalPages}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-md border-b border-outline-variant">
        <button
          onClick={() => setTab("transactions")}
          className={`pb-sm px-1 text-body-sm font-medium transition-colors border-b-2 ${
            tab === "transactions"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Operaciones
        </button>
        <button
          onClick={() => setTab("categories")}
          className={`pb-sm px-1 text-body-sm font-medium transition-colors border-b-2 ${
            tab === "categories"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Gestionar Categorías
        </button>
      </div>

      {tab === "categories" ? (
        selectedCategory ? (
          <>
            <div className="flex items-center gap-md mb-md">
              <button onClick={() => setSelectedCategory(null)} className="px-md py-sm bg-surface-container-high text-on-surface rounded-lg text-body-sm">
                ← Volver a categorías
              </button>
              <span className="text-body-sm font-medium text-on-surface">
                {selectedCategory.group} / {selectedCategory.type}
              </span>
              <span className="text-body-sm text-on-surface-variant">
                ({categoryTransactions.length} transacciones)
              </span>
            </div>
            <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-high text-label-caps text-on-surface-variant">
                      <th className="p-md">Fecha</th>
                      <th className="p-md">Concepto</th>
                      <th className="p-md">Banco</th>
                      <th className="p-md text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {loadingCatTx ? (
                      <tr><td colSpan={4} className="p-lg text-center text-on-surface-variant">Cargando...</td></tr>
                    ) : categoryTransactions.length === 0 ? (
                      <tr><td colSpan={4} className="p-lg text-center text-on-surface-variant">No hay transacciones</td></tr>
                    ) : (
                      categoryTransactions.map(t => (
                        <tr key={t.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="p-md text-on-surface-variant">{fmtDate(t.timestamp)}</td>
                          <td className="p-md text-on-surface font-medium">{t.concept}</td>
                          <td className="p-md text-on-surface-variant text-body-sm">{t.bank?.bank_name || "-"}</td>
                          <td className={`p-md text-right font-mono ${Number(t.amount) < 0 ? "text-error" : "text-success"}`}>
                            <ValueBlur hidden={hideValues}>{formatSpanish(Math.abs(Number(t.amount)))}€</ValueBlur>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <>
              <div className="flex flex-wrap gap-sm items-end bg-surface-container border border-outline-variant rounded-xl p-md">
              <div className="flex flex-col gap-xs">
                <label className="text-label-caps text-on-surface-variant">Categoría</label>
                <input
                  type="text"
                  value={catFilters.category}
                  onChange={e => setCatFilters(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="Buscar..."
                  className="bg-surface-container-high rounded px-2 py-1.5 text-body-sm text-on-surface border border-outline-variant w-40"
                />
              </div>
              <div className="flex flex-col gap-xs">
                <label className="text-label-caps text-on-surface-variant">Tipo</label>
                <select
                  value={catFilters.type}
                  onChange={e => setCatFilters(prev => ({ ...prev, type: e.target.value }))}
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
                      <th className="p-md">Categoría</th>
                      <th className="p-md">Tipo</th>
                      <th className="p-md">Transacciones</th>
                      <th className="p-md w-32">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {catGroups.map((g) => (
                      <tr key={`${g.group}-${g.type}`} className="hover:bg-surface-container-low transition-colors">
                        {editingGroup?.oldGroup === g.group && editingGroup?.newType === g.type ? (
                          <>
                            <td className="p-md">
                              <input
                                type="text"
                                value={editingGroup.newGroup}
                                onChange={(e) =>
                                  setEditingGroup({ ...editingGroup, newGroup: e.target.value })
                                }
                                className="bg-surface-container-high rounded px-2 py-1 text-body-sm text-on-surface border border-outline-variant w-full"
                              />
                            </td>
                            <td className="p-md">
                              <select
                                value={editingGroup.newType}
                                onChange={(e) =>
                                  setEditingGroup({ ...editingGroup, newType: e.target.value })
                                }
                                className="bg-surface-container-high rounded px-2 py-1 text-body-sm text-on-surface border border-outline-variant"
                              >
                                {TYPES.map((t) => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </td>
                            <td className="p-md text-body-sm text-on-surface-variant">{g.count}</td>
                            <td className="p-md">
                              <div className="flex gap-1">
                                <button
                                  onClick={async () => {
                                    if (!editingGroup) return;
                                    await fetch("/api/transactions/bulk-update-category", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        oldGroup: editingGroup.oldGroup,
                                        newGroup: editingGroup.newGroup || editingGroup.oldGroup,
                                        newType: editingGroup.newType,
                                      }),
                                    });
                                    setEditingGroup(null);
                                    fetchGroups();
                                    fetchTransactions();
                                    fetchCatGroups();
                                  }}
                                  className="text-primary hover:underline text-body-sm"
                                >
                                  Guardar
                                </button>
                                <button
                                  onClick={() => setEditingGroup(null)}
                                  className="text-on-surface-variant hover:text-on-surface text-body-sm"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-md">
                              <button
                                onClick={() => handleCategoryClick({ group: g.group, type: g.type })}
                                className="text-primary hover:underline font-medium text-left"
                              >
                                {g.group}
                              </button>
                            </td>
                            <td className="p-md">
                              <ConditionalChip
                                label={g.type}
                                variant={g.type === "Fijo" ? "info" : "warning"}
                              />
                            </td>
                            <td className="p-md text-body-sm text-on-surface-variant">{g.count}</td>
                            <td className="p-md">
                              {migratingGroup === g.group ? (
                                <div className="flex items-center gap-1">
                                  <select
                                    value={migrateTarget}
                                    onChange={e => setMigrateTarget(e.target.value)}
                                    className="bg-surface-container-high rounded px-1 py-1 text-label-caps text-on-surface border border-outline-variant w-28"
                                  >
                                    <option value="">Seleccionar...</option>
                                    {[...new Set(catGroups.map(cg => cg.group))]
                                      .filter(cg => cg !== g.group)
                                      .sort()
                                      .map(cg => (
                                        <option key={cg} value={cg}>{cg}</option>
                                      ))}
                                  </select>
                                  <button
                                    onClick={async () => {
                                      if (!migrateTarget) return;
                                      await fetch("/api/transactions/bulk-update-category", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ oldGroup: g.group, newGroup: migrateTarget }),
                                      });
                                      setMigratingGroup(null);
                                      setMigrateTarget("");
                                      fetchGroups();
                                      fetchTransactions();
                                      fetchCatGroups();
                                    }}
                                    className="text-primary hover:underline text-label-caps"
                                  >
                                    Migrar
                                  </button>
                                  <button
                                    onClick={() => { setMigratingGroup(null); setMigrateTarget(""); }}
                                    className="text-on-surface-variant hover:text-on-surface text-label-caps"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingGroup({ oldGroup: g.group, newGroup: g.group, newType: g.type });
                                      setMigratingGroup(null);
                                    }}
                                    className="text-primary hover:underline text-body-sm"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => { setMigratingGroup(g.group); setMigrateTarget(""); setEditingGroup(null); }}
                                    className="text-warning hover:underline text-body-sm"
                                  >
                                    Migrar
                                  </button>
                                </div>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                    {catGroups.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-lg text-center text-on-surface-variant">
                          No hay transacciones
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      ) : (
        <>
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
            {[...new Set(groups.map(g => g.group))].sort().map(c => (
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
            {[...new Set(groups.map(g => g.type))].sort().map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-primary-container border border-outline-variant rounded-xl p-md flex items-center gap-md flex-wrap">
          <span className="text-body-sm font-medium text-on-primary-container">
            {selectedIds.size} seleccionado{selectedIds.size !== 1 ? "s" : ""}
          </span>

          {!batchModal.open ? (
            <>
              <button onClick={() => { setBatchModal({ field: "timestamp", open: true }); setBatchValue(""); }} className="px-md py-sm bg-primary text-on-primary rounded-lg text-body-sm">
                Cambiar Fecha
              </button>
              <button onClick={() => { setBatchModal({ field: "concept", open: true }); setBatchValue(""); }} className="px-md py-sm bg-primary text-on-primary rounded-lg text-body-sm">
                Cambiar Concepto
              </button>
              <button onClick={() => { setBatchModal({ field: "bank_id", open: true }); setBatchValue(""); }} className="px-md py-sm bg-primary text-on-primary rounded-lg text-body-sm">
                Cambiar Banco
              </button>
              <button onClick={() => { setBatchModal({ field: "group", open: true }); setBatchValue(""); }} className="px-md py-sm bg-primary text-on-primary rounded-lg text-body-sm">
                Cambiar Categoría
              </button>
              <button onClick={() => { setBatchModal({ field: "type", open: true }); setBatchValue(""); }} className="px-md py-sm bg-primary text-on-primary rounded-lg text-body-sm">
                Cambiar Tipo
              </button>
              <button onClick={deleteSelected} className="px-md py-sm bg-error text-on-error rounded-lg text-body-sm">
                Eliminar seleccionadas
              </button>
              <button onClick={clearSelection} className="px-md py-sm bg-surface-container-high text-on-surface rounded-lg text-body-sm">
                Deseleccionar todo
              </button>
            </>
          ) : (
            <div className="flex items-center gap-md flex-wrap">
              <span className="text-body-sm text-on-primary-container">
                {batchModal.field === "timestamp" ? "Nueva fecha:" :
                 batchModal.field === "bank_id" ? "Nuevo banco:" :
                 batchModal.field === "group" ? "Nueva categoría:" :
                 batchModal.field === "type" ? "Nuevo tipo:" :
                 batchModal.field === "concept" ? "Nuevo concepto:" : ""}
              </span>
              {batchModal.field === "timestamp" && (
                <input type="date" value={batchValue} onChange={e => setBatchValue(e.target.value)}
                  className="bg-surface-container-high rounded px-2 py-1.5 text-body-sm text-on-surface border border-outline-variant" />
              )}
              {batchModal.field === "bank_id" && (
                <select value={batchValue} onChange={e => setBatchValue(e.target.value)}
                  className="bg-surface-container-high rounded px-2 py-1.5 text-body-sm text-on-surface border border-outline-variant">
                  <option value="">Seleccionar</option>
                  {banks.map(b => (
                    <option key={b.id} value={b.id}>{b.bank_name}</option>
                  ))}
                </select>
              )}
              {batchModal.field === "group" && (
                <select value={batchValue} onChange={e => setBatchValue(e.target.value)}
                  className="bg-surface-container-high rounded px-2 py-1.5 text-body-sm text-on-surface border border-outline-variant">
                  <option value="">Seleccionar</option>
                  {(categories.length > 0 ? categories : CATEGORIES).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
              {batchModal.field === "type" && (
                <select value={batchValue} onChange={e => setBatchValue(e.target.value)}
                  className="bg-surface-container-high rounded px-2 py-1.5 text-body-sm text-on-surface border border-outline-variant">
                  <option value="">Seleccionar</option>
                  {TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
              {batchModal.field === "concept" && (
                <div className="min-w-[200px]">
                  <ConceptCombobox
                    value={batchValue}
                    onChange={setBatchValue}
                    wrapperClassName="bg-surface-container-high rounded border border-outline-variant"
                    inputClassName="w-full bg-transparent border-none focus:ring-0 text-body-sm px-2 py-1.5 text-on-surface"
                  />
                </div>
              )}
              <button onClick={handleBatchUpdate} disabled={!batchValue}
                className="px-md py-sm bg-primary text-on-primary rounded-lg text-body-sm disabled:opacity-50">
                Aplicar
              </button>
              <button onClick={() => { setBatchModal({ field: "", open: false }); setBatchValue(""); }}
                className="px-md py-sm bg-surface-container-high text-on-surface rounded-lg text-body-sm">
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-high text-label-caps text-on-surface-variant">
                <th className="p-md w-10">
                  <input
                    type="checkbox"
                    onChange={toggleSelectAll}
                    checked={selectedIds.size === transactions.length && transactions.length > 0}
                  />
                </th>
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
                  <td colSpan={8} className="p-lg text-center text-on-surface-variant">
                    Cargando...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-lg text-center text-on-surface-variant">
                    No hay transacciones
                  </td>
                </tr>
              ) : (
                transactions.map(t => (
                  <tr key={t.id} className="hover:bg-surface-container-low transition-colors">
                    {editingId === t.id ? (
                      <>
                        <td className="p-md w-10">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(t.id)}
                            onChange={() => toggleSelect(t.id)}
                          />
                        </td>
                        <td className="p-md">
                          <input
                            type="date"
                            value={editForm.timestamp}
                            onChange={e => setEditForm({...editForm, timestamp: e.target.value})}
                            className="bg-surface-container-high rounded px-2 py-1 text-body-sm text-on-surface border border-outline-variant w-36"
                          />
                        </td>
                        <td className="p-md">
                          <ConceptCombobox
                            value={editForm.concept}
                            onChange={value => setEditForm({...editForm, concept: value})}
                            wrapperClassName="bg-surface-container-high rounded border border-outline-variant"
                            inputClassName="w-full bg-transparent border-none focus:ring-0 text-body-sm px-2 py-1 text-on-surface"
                          />
                        </td>
                        <td className="p-md">
                          <input
                            value={editForm.comentarios}
                            onChange={e => setEditForm({...editForm, comentarios: e.target.value})}
                            className="bg-surface-container-high rounded px-2 py-1 text-body-sm text-on-surface border border-outline-variant"
                            placeholder="Notas..."
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
                            {categories.length > 0 ? categories.map(c => (
                              <option key={c} value={c}>{c}</option>
                            )) : CATEGORIES.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-md">
                          <ConditionalChip
                            label={editForm.type}
                            variant={editForm.type === "Fijo" ? "info" : "warning"}
                          />
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
                        <td className="p-md w-10">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(t.id)}
                            onChange={() => toggleSelect(t.id)}
                          />
                        </td>
                        <td className="p-md text-on-surface-variant">
                          {fmtDate(t.timestamp)}
                        </td>
                        <td className="p-md">
                          <div className="text-on-surface font-medium">{t.concept}</div>
                          {t.comentarios && (
                            <div className="text-on-surface-variant text-body-sm mt-xs">
                              {t.comentarios}
                            </div>
                          )}
                        </td>
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
                          <ValueBlur hidden={hideValues}>{formatSpanish(Math.abs(Number(t.amount)))}€</ValueBlur>
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
        </>
      )}
    </div>
  );
}