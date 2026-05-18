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

const CATEGORIES = [
  "Ingresos", "Ocio", "Compras", "JustEat", "Streaming",
  "Ropa", "Hogar", "Supermercado", "Transporte", "Salud",
  "Educación", "Servicios",
];
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
  const [newRule, setNewRule] = useState({ pattern: "", group: "Ocio", type: "Variable", bank_id: "" });

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
    ]).then(([rulesData, banksData]) => {
      setRules(Array.isArray(rulesData) ? rulesData : rulesData.rules || []);
      setBanks(Array.isArray(banksData) ? banksData : []);
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
    await fetch("/api/mapping-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pattern: newRule.pattern,
        default_group: newRule.group,
        default_type: newRule.type,
        default_bank_id: newRule.bank_id || null,
      }),
    });
    setShowAddRule(false);
    setNewRule({ pattern: "", group: "Ocio", type: "Variable", bank_id: "" });
    const res = await fetch("/api/mapping-rules");
    const data = await res.json();
    setRules(Array.isArray(data) ? data : data.rules || []);
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
        <button
          onClick={() => setShowAddRule(true)}
          className="flex items-center gap-2 px-lg py-md bg-black text-white rounded-lg text-body-sm hover:bg-black/80"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Nueva Regla
        </button>
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

      {showAddRule && (
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
            <select
              value={newRule.group}
              onChange={e => setNewRule({...newRule, group: e.target.value})}
              className="bg-surface-container-high rounded px-3 py-2 text-body-sm text-on-surface border border-outline-variant"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
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
              <button onClick={addRule} className="px-lg py-md bg-primary text-on-primary rounded-lg text-body-sm">Guardar</button>
              <button onClick={() => setShowAddRule(false)} className="px-lg py-md bg-surface-container-high text-on-surface-variant rounded-lg text-body-sm">Cancelar</button>
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