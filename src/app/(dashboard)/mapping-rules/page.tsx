"use client";

import { useState, useEffect } from "react";

interface MappingRule {
  id: string;
  pattern: string;
  default_group: string;
  default_type: string;
  default_bank_id: string | null;
}

interface Bank {
  id: string;
  bank_name: string;
}

const TYPES = ["Fijo", "Variable"];

export default function MappingRulesPage() {
  const [rules, setRules] = useState<MappingRule[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ pattern: "", group: "", type: "", bank_id: "" });
  const [filter, setFilter] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/mapping-rules").then(r => r.json()),
      fetch("/api/banks").then(r => r.json()),
      fetch("/api/categories").then(r => r.json()),
    ]).then(([rulesData, banksData, cats]) => {
      setRules(Array.isArray(rulesData) ? rulesData : rulesData.rules || []);
      setBanks(Array.isArray(banksData) ? banksData : []);
      setCategories(Array.isArray(cats) ? cats.sort() : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function startEdit(r: MappingRule) {
    setEditingId(r.id);
    setEditForm({
      pattern: r.pattern,
      group: r.default_group,
      type: r.default_type,
      bank_id: r.default_bank_id || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ pattern: "", group: "", type: "", bank_id: "" });
  }

  async function saveEdit(id: string) {
    await fetch(`/api/mapping-rules/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pattern: editForm.pattern,
        default_group: editForm.group,
        default_type: editForm.type,
        default_bank_id: editForm.bank_id || null,
      }),
    });
    setEditingId(null);
    const res = await fetch("/api/mapping-rules");
    const data = await res.json();
    setRules(Array.isArray(data) ? data : data.rules || []);
  }

  async function deleteRule(id: string) {
    if (!confirm("¿Eliminar esta regla?")) return;
    await fetch(`/api/mapping-rules/${id}`, { method: "DELETE" });
    setRules(rules.filter(r => r.id !== id));
  }

  const filteredRules = rules.filter(r =>
    r.pattern.toLowerCase().includes(filter.toLowerCase()) ||
    r.default_group.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-lg space-y-lg">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-headline-md text-on-surface">Reglas de Mapeo</h1>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Buscar..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="bg-surface-container-high rounded-lg px-3 py-2 text-body-sm text-on-surface border border-outline-variant w-48"
          />
        </div>
      </div>

      <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-high text-label-caps text-on-surface-variant">
                <th className="p-md">Patrón</th>
                <th className="p-md">Categoría</th>
                <th className="p-md">Tipo</th>
                <th className="p-md w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-lg text-center text-on-surface-variant">
                    Cargando...
                  </td>
                </tr>
              ) : filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-lg text-center text-on-surface-variant">
                    No hay reglas
                  </td>
                </tr>
              ) : (
                filteredRules.map(r => (
                  <tr key={r.id} className="hover:bg-surface-container-low transition-colors">
                    {editingId === r.id ? (
                      <>
                        <td className="p-md">
                          <input
                            value={editForm.pattern}
                            onChange={e => setEditForm({...editForm, pattern: e.target.value})}
                            className="bg-surface-container-high rounded px-2 py-1 text-body-sm text-on-surface border border-outline-variant w-full"
                          />
                        </td>
                        <td className="p-md">
                          <select
                            value={editForm.group}
                            onChange={e => setEditForm({...editForm, group: e.target.value})}
                            className="bg-surface-container-high rounded px-2 py-1 text-body-sm text-on-surface border border-outline-variant"
                          >
                            {categories.map(c => (
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
                          <div className="flex gap-1">
                            <button onClick={() => saveEdit(r.id)} className="text-primary hover:underline text-body-sm">
                              Guardar
                            </button>
                            <button onClick={cancelEdit} className="text-on-surface-variant hover:text-on-surface text-body-sm">
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-md text-on-surface font-medium">{r.pattern}</td>
                        <td className="p-md text-on-surface-variant text-body-sm">{r.default_group}</td>
                        <td className="p-md text-on-surface-variant text-body-sm">{r.default_type}</td>
                        <td className="p-md">
                          <div className="flex gap-2">
                            <button onClick={() => startEdit(r)} className="text-primary hover:text-primary/80">
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            <button onClick={() => deleteRule(r.id)} className="text-error hover:text-error/80">
                              <span className="material-symbols-outlined text-lg">delete</span>
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

      <div className="text-body-sm text-on-surface-variant">
        Total: {filteredRules.length} reglas
      </div>
    </div>
  );
}