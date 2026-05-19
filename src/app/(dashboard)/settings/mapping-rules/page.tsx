"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

export default function MappingRulesSettingsPage() {
  const pathname = usePathname();
  const [rules, setRules] = useState<MappingRule[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ pattern: "", group: "", type: "", bank_id: "" });
  const [filter, setFilter] = useState("");
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({ pattern: "", group: "", type: "Variable", bank_id: "" });
  const [conflict, setConflict] = useState<{
    existing: { id: string; pattern: string; default_group: string; default_type: string; default_bank_id: string | null };
    incoming: { pattern: string; default_group: string; default_type: string; default_bank_id: string | null };
  } | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const subNavItems = [
    { href: "/settings", label: "General", icon: "settings" },
    { href: "/settings/banks", label: "Bancos", icon: "account_balance" },
    { href: "/settings/mapping-rules", label: "Mapeos", icon: "rule" },
    { href: "/settings/import", label: "Importar", icon: "upload" },
  ];

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

  async function addRule() {
    const res = await fetch("/api/mapping-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pattern: newRule.pattern,
        default_group: newRule.group,
        default_type: newRule.type,
        default_bank_id: newRule.bank_id || null,
      }),
    });
    const data = await res.json();

    if (res.status === 409 && data.status === "conflicto") {
      setConflict({ existing: data.existing, incoming: data.incoming });
      return;
    }

    setShowAddRule(false);
    setNewRule({ pattern: "", group: "Ocio", type: "Variable", bank_id: "" });
    const r = await fetch("/api/mapping-rules");
    const d = await r.json();
    setRules(Array.isArray(d) ? d : d.rules || []);
  }

  async function resolveConflict(useIncoming: boolean) {
    if (!conflict) return;
    if (useIncoming) {
      await fetch(`/api/mapping-rules/${conflict.existing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pattern: conflict.incoming.pattern,
          default_group: conflict.incoming.default_group,
          default_type: conflict.incoming.default_type,
          default_bank_id: conflict.incoming.default_bank_id,
        }),
      });
    }
    setConflict(null);
    setShowAddRule(false);
    setNewRule({ pattern: "", group: "Ocio", type: "Variable", bank_id: "" });
    const r = await fetch("/api/mapping-rules");
    const d = await r.json();
    setRules(Array.isArray(d) ? d : d.rules || []);
  }

  const filteredRules = rules.filter(r =>
    r.pattern.toLowerCase().includes(filter.toLowerCase()) ||
    r.default_group.toLowerCase().includes(filter.toLowerCase())
  );

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

      <div className="flex justify-between items-center">
        <h1 className="text-headline-md text-on-surface">Reglas de Mapeo</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddRule(true)}
            className="flex items-center gap-2 px-lg py-md bg-black text-white rounded-lg text-body-sm hover:bg-black/80"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Nueva Regla
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Buscar..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="bg-surface-container-high rounded-lg px-3 py-2 text-body-sm text-on-surface border border-outline-variant w-64"
        />
      </div>

      {showAddRule && !conflict && (
        <div className="bg-surface-container border border-outline-variant rounded-xl p-lg">
          <h3 className="text-headline-md text-on-surface mb-lg">Nueva Regla</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-md">
            <input
              type="text"
              placeholder="Patrón"
              value={newRule.pattern}
              onChange={e => setNewRule({...newRule, pattern: e.target.value})}
              className="bg-surface-container-high rounded px-3 py-2 text-body-sm text-on-surface border border-outline-variant"
            />
            {showNewCategory ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nueva categoría"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  className="bg-surface-container-high rounded px-3 py-2 text-body-sm text-on-surface border border-outline-variant flex-1"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (newCategoryName.trim()) {
                      setNewRule({...newRule, group: newCategoryName.trim()});
                      setShowNewCategory(false);
                      setNewCategoryName("");
                    }
                  }}
                  className="px-lg py-md bg-primary text-on-primary rounded-lg text-body-sm"
                >
                  Usar
                </button>
                <button
                  onClick={() => { setShowNewCategory(false); setNewCategoryName(""); }}
                  className="px-lg py-md bg-surface-container-high text-on-surface-variant rounded-lg text-body-sm"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <select
                value={newRule.group}
                onChange={e => {
                  if (e.target.value === "__new__") {
                    setShowNewCategory(true);
                  } else {
                    setNewRule({...newRule, group: e.target.value});
                  }
                }}
                className="bg-surface-container-high rounded px-3 py-2 text-body-sm text-on-surface border border-outline-variant"
              >
                <option value="" disabled>Selecciona categoría</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="__new__">➕ Crear nueva...</option>
              </select>
            )}
            <select
              value={newRule.type}
              onChange={e => setNewRule({...newRule, type: e.target.value})}
              className="bg-surface-container-high rounded px-3 py-2 text-body-sm text-on-surface border border-outline-variant"
            >
              {TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={addRule} disabled={!newRule.group} className="px-lg py-md bg-primary text-on-primary rounded-lg text-body-sm disabled:opacity-50">Guardar</button>
              <button onClick={() => setShowAddRule(false)} className="px-lg py-md bg-surface-container-high text-on-surface-variant rounded-lg text-body-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {conflict && (
        <div className="bg-surface-container border border-outline-variant rounded-xl p-lg">
          <h3 className="text-headline-md text-on-surface mb-lg">Conflicto: patrón "{conflict.existing.pattern}" ya existe</h3>
          <p className="text-body-sm text-on-surface-variant mb-lg">La categoría o el tipo no coinciden. Elige qué valores conservar:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div className="border border-outline-variant rounded-lg p-lg">
              <h4 className="text-label-caps text-on-surface-variant uppercase mb-md">Existente</h4>
              <p className="text-body-md text-on-surface">Categoría: <strong>{conflict.existing.default_group}</strong></p>
              <p className="text-body-md text-on-surface">Tipo: <strong>{conflict.existing.default_type}</strong></p>
              <button
                onClick={() => resolveConflict(false)}
                className="mt-md px-lg py-md bg-surface-container-high text-on-surface rounded-lg text-body-sm hover:bg-surface-container-high/80"
              >
                Mantener existente
              </button>
            </div>
            <div className="border border-outline-variant rounded-lg p-lg">
              <h4 className="text-label-caps text-on-surface-variant uppercase mb-md">Nueva</h4>
              <p className="text-body-md text-on-surface">Categoría: <strong>{conflict.incoming.default_group}</strong></p>
              <p className="text-body-md text-on-surface">Tipo: <strong>{conflict.incoming.default_type}</strong></p>
              <button
                onClick={() => resolveConflict(true)}
                className="mt-md px-lg py-md bg-primary text-on-primary rounded-lg text-body-sm hover:bg-primary/80"
              >
                Usar nueva
              </button>
            </div>
          </div>
        </div>
      )}

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
                            <button onClick={() => saveEdit(r.id)} className="text-primary hover:underline text-body-sm">Guardar</button>
                            <button onClick={cancelEdit} className="text-on-surface-variant hover:text-on-surface text-body-sm">Cancelar</button>
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