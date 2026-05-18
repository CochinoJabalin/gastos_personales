"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ConditionalChip from "@/components/ConditionalChip";
import { parseSpanishNumber } from "@/lib/format";

interface Bank {
  id: string;
  bank_name: string;
  account_label: string;
}

interface InferenceResult {
  source: string;
  bank_id: string | null;
  bank_name: string | null;
  group: string;
  type: string;
}

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

const TYPES = ["Fijo", "Variable"];

interface CommonTransaction {
  concept: string;
  group: string;
  type: string;
  bank_id: string;
  bank_name: string | null;
  count: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  Ingresos: "payments",
  Ocio: "celebration",
  Compras: "shopping_cart",
  JustEat: "delivery_dining",
  Streaming: "smart_display",
  Ropa: "checkroom",
  Hogar: "home",
  Supermercado: "local_grocery_store",
  Transporte: "directions_bus",
  Salud: "local_hospital",
  Educación: "school",
  Servicios: "receipt_long",
};

export default function QuickEntryPage() {
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [bankId, setBankId] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("Variable");
  const [comentarios, setComentarios] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPeriod, setRecurringPeriod] = useState("");
  const [inference, setInference] = useState<InferenceResult | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [conceptTouched, setConceptTouched] = useState(false);
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [commonTransactions, setCommonTransactions] = useState<CommonTransaction[]>([]);
  const [hiddenConcepts, setHiddenConcepts] = useState<Set<string>>(new Set());
  const [customSuggestions, setCustomSuggestions] = useState<CommonTransaction[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSuggConcept, setNewSuggConcept] = useState("");
  const [newSuggGroup, setNewSuggGroup] = useState("");
  const [newSuggType, setNewSuggType] = useState("Variable");
  const [newSuggBankId, setNewSuggBankId] = useState("");
  const catDropdownRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/banks")
      .then((r) => r.json())
      .then(setBanks)
      .catch(() => {});
    fetch("/api/mapping-rules")
      .then((r) => r.json())
      .then((rules: { default_group: string }[]) => {
        const cats = [...new Set(rules.map((r) => r.default_group))].sort();
        setCategories(cats);
        if (cats.length > 0) setCategory(cats[0]);
      })
      .catch(() => {});
    fetch("/api/transactions/common")
      .then((r) => r.json())
      .then(setCommonTransactions)
      .catch(() => {});
    try {
      const hidden = JSON.parse(localStorage.getItem("hiddenSuggestions") || "[]");
      setHiddenConcepts(new Set(hidden));
      const custom = JSON.parse(localStorage.getItem("customSuggestions") || "[]");
      setCustomSuggestions(custom);
    } catch {}
  }, []);

  function toggleHideConcept(concept: string) {
    setHiddenConcepts(prev => {
      const next = new Set(prev);
      if (next.has(concept)) next.delete(concept);
      else next.add(concept);
      localStorage.setItem("hiddenSuggestions", JSON.stringify([...next]));
      return next;
    });
  }

  function removeCustomSuggestion(concept: string) {
    setCustomSuggestions(prev => {
      const next = prev.filter(s => s.concept !== concept);
      localStorage.setItem("customSuggestions", JSON.stringify(next));
      return next;
    });
  }

  function addCustomSuggestion() {
    if (!newSuggConcept.trim()) return;
    const bank = banks.find(b => b.id === newSuggBankId);
    const entry: CommonTransaction = {
      concept: newSuggConcept.trim(),
      group: newSuggGroup || categories[0] || "Ocio",
      type: newSuggType,
      bank_id: newSuggBankId,
      bank_name: bank?.bank_name || null,
      count: 0,
    };
    setCustomSuggestions(prev => {
      const next = [...prev.filter(s => s.concept !== entry.concept), entry];
      localStorage.setItem("customSuggestions", JSON.stringify(next));
      return next;
    });
    setNewSuggConcept("");
    setNewSuggGroup("");
    setNewSuggType("Variable");
    setNewSuggBankId("");
    setShowAddForm(false);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (catDropdownRef.current && !catDropdownRef.current.contains(e.target as Node)) {
        setCatDropdownOpen(false);
        setCatSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const infer = useCallback(async (text: string) => {
    if (!text || text.length < 2) {
      setInference(null);
      return;
    }
    try {
      const res = await fetch("/api/infer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept: text }),
      });
      const result = await res.json();
      if (result && result.group) {
        setInference(result);
        const mappedCategory = CATEGORY_MAP[result.group] || result.group;
        setCategories((prev) =>
          prev.includes(mappedCategory) ? prev : [...prev, mappedCategory].sort()
        );
        setCategory(mappedCategory);
        if (result.type) {
          const normalizedType = result.type.toLowerCase();
          if (normalizedType === "fijo") setType("Fijo");
          else if (normalizedType === "variable") setType("Variable");
        }
        if (result.bank_id) setBankId(result.bank_id);
      } else {
        setInference(null);
      }
    } catch {
      setInference(null);
    }
  }, []);

  useEffect(() => {
    if (conceptTouched) {
      const timer = setTimeout(() => infer(concept), 400);
      return () => clearTimeout(timer);
    }
  }, [concept, conceptTouched, infer]);

  const hasInferenceMatch = inference?.source === "mapping_rule";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseSpanishNumber(amount),
          concept,
          bank_id: bankId,
          group: category,
          type,
          is_recurring: isRecurring,
          recurring_period: isRecurring ? recurringPeriod : null,
          comentarios: comentarios || null,
        }),
      });
      if (res.ok) {
        setSuccess(true);
        setAmount("");
        setConcept("");
        setComentarios("");
        setBankId("");
        setCategory(categories[0] || "");
        setType("Variable");
        setInference(null);
        setConceptTouched(false);
        setTimeout(() => setSuccess(false), 2000);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleQuickSuggestion(t: CommonTransaction) {
    setConcept(t.concept);
    setConceptTouched(true);
    setCategory(t.group);
    setType(t.type);
    setBankId(t.bank_id);
    infer(t.concept);
    setTimeout(() => amountRef.current?.focus(), 0);
  }

  function handleConceptChange(e: React.ChangeEvent<HTMLInputElement>) {
    setConcept(e.target.value);
    setConceptTouched(true);
    if (!e.target.value.trim()) {
      setInference(null);
    }
  }

  return (
    <div className="max-w-md mx-auto py-lg space-y-lg">
      <form
        onSubmit={handleSubmit}
        className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden"
      >
        <div className="p-lg space-y-lg">
          <div className="space-y-xs">
            <label className="text-label-caps text-on-surface-variant uppercase">
              Concepto <span className="text-error">*</span>
            </label>
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant focus-within:border-primary transition-colors">
              <input
                type="text"
                value={concept}
                onChange={handleConceptChange}
                onBlur={() => setConceptTouched(true)}
                className="w-full bg-transparent border-none focus:ring-0 text-body-md py-md px-md text-on-surface"
                placeholder="Escribe el concepto (ej: Mercadona, Netflix...)"
                required
              />
            </div>
          </div>

          <div className="space-y-xs">
            <label className="text-label-caps text-on-surface-variant uppercase">
              Importe <span className="text-error">*</span>
            </label>
            <div className="relative flex items-center bg-surface-container-lowest rounded-lg border border-outline-variant focus-within:border-primary transition-colors">
              <span className="pl-md text-headline-md text-on-surface-variant">€</span>
              <input
                ref={amountRef}
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
              Comentarios
            </label>
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant focus-within:border-primary transition-colors">
              <textarea
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
                className="w-full bg-transparent border-none focus:ring-0 text-body-sm py-md px-md text-on-surface resize-none"
                placeholder="Notas opcionales..."
                rows={2}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-gutter">
            <div className="space-y-xs">
              <label className="text-label-caps text-on-surface-variant uppercase">
                Banco
              </label>
              <select
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
                className="w-full bg-surface-container-high rounded-lg px-md py-md text-body-md text-on-surface border-0 focus:ring-1 focus:ring-primary"
                required
              >
                <option value="">Seleccionar</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name} - {b.account_label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-xs">
              <label className="text-label-caps text-on-surface-variant uppercase">
                Categoría
              </label>
              <div className="relative" ref={catDropdownRef}>
                <button
                  type="button"
                  onClick={() => { setCatDropdownOpen(!catDropdownOpen); setCatSearch(""); }}
                  className="w-full bg-surface-container-high rounded-lg px-md py-md text-body-md text-on-surface border-0 focus:ring-1 focus:ring-primary text-left flex items-center justify-between"
                >
                  <span>{category || "Seleccionar"}</span>
                  <span className="material-symbols-outlined text-on-surface-variant">
                    {catDropdownOpen ? "expand_less" : "expand_more"}
                  </span>
                </button>
                {catDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-surface-container-high rounded-lg border border-outline-variant shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-outline-variant">
                      <input
                        type="text"
                        value={catSearch}
                        onChange={(e) => setCatSearch(e.target.value)}
                        placeholder="Buscar categoría..."
                        className="w-full bg-surface-container-lowest rounded-md px-3 py-2 text-body-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {categories.filter((c) =>
                        c.toLowerCase().includes(catSearch.toLowerCase())
                      ).length === 0 ? (
                        <div className="px-3 py-2 text-body-sm text-on-surface-variant">
                          Sin resultados
                        </div>
                      ) : (
                        categories
                          .filter((c) =>
                            c.toLowerCase().includes(catSearch.toLowerCase())
                          )
                          .map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setCategory(c);
                                setCatDropdownOpen(false);
                                setCatSearch("");
                              }}
                              className={`w-full text-left px-3 py-2 text-body-sm hover:bg-surface-container-highest transition-colors ${
                                c === category
                                  ? "bg-primary-container text-primary"
                                  : "text-on-surface"
                              }`}
                            >
                              {c}
                            </button>
                          ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-gutter">
            <div className="space-y-xs">
              <label className="text-label-caps text-on-surface-variant uppercase">
                Tipo
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-surface-container-high rounded-lg px-md py-md text-body-md text-on-surface border-0 focus:ring-1 focus:ring-primary"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-xs">
              <label className="text-label-caps text-on-surface-variant uppercase">
                Recurrencia
              </label>
              <select
                value={isRecurring ? recurringPeriod : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setIsRecurring(true);
                    setRecurringPeriod(val);
                  } else {
                    setIsRecurring(false);
                    setRecurringPeriod("");
                  }
                }}
                className="w-full bg-surface-container-high rounded-lg px-md py-md text-body-md text-on-surface border-0 focus:ring-1 focus:ring-primary"
              >
                <option value="">No recurrente</option>
                <option value="mensual">Mensual</option>
                <option value="anual">Anual</option>
              </select>
            </div>
          </div>

          {inference && (
            <div className="flex flex-wrap gap-sm pt-xs">
              <ConditionalChip
                label={hasInferenceMatch ? "Regla de Mapeo" : "Auto-detectado"}
                variant={hasInferenceMatch ? "success" : "info"}
                icon="auto_awesome"
              />
              {isRecurring && (
                <ConditionalChip
                  label="Transacción Frecuente"
                  variant="warning"
                />
              )}
            </div>
          )}

          {success ? (
            <div className="w-full bg-positive/20 text-positive text-body-md font-semibold py-md rounded-lg text-center">
              ✓ Transacción registrada
            </div>
          ) : (
            <button
              type="submit"
              disabled={submitting || !concept.trim()}
              className="w-full bg-primary text-primary-on text-body-md font-semibold py-md rounded-lg active:scale-95 transition-transform shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {submitting ? "Registrando..." : "Registrar Transacción"}
            </button>
          )}
        </div>
      </form>

      <div className="bg-surface-container-low border border-outline-variant rounded-xl p-lg">
        <div className="flex items-center justify-between mb-md">
          <h3 className="text-label-caps text-on-surface-variant uppercase">
            Sugerencias Rápidas
          </h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-xs text-primary hover:underline text-body-sm font-medium"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Añadir
          </button>
        </div>

        {showAddForm && (
          <div className="mb-md p-md bg-surface-container-highest rounded-lg border border-outline-variant space-y-sm">
            <input
              type="text"
              value={newSuggConcept}
              onChange={e => setNewSuggConcept(e.target.value)}
              placeholder="Concepto (ej: Cafe diario)"
              className="w-full bg-surface-container-lowest rounded-md px-3 py-2 text-body-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="grid grid-cols-3 gap-sm">
              <select
                value={newSuggGroup}
                onChange={e => setNewSuggGroup(e.target.value)}
                className="bg-surface-container-lowest rounded-md px-2 py-2 text-body-sm text-on-surface border border-outline-variant"
              >
                <option value="">Categoría</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={newSuggType}
                onChange={e => setNewSuggType(e.target.value)}
                className="bg-surface-container-lowest rounded-md px-2 py-2 text-body-sm text-on-surface border border-outline-variant"
              >
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={newSuggBankId}
                onChange={e => setNewSuggBankId(e.target.value)}
                className="bg-surface-container-lowest rounded-md px-2 py-2 text-body-sm text-on-surface border border-outline-variant"
              >
                <option value="">Banco</option>
                {banks.map(b => <option key={b.id} value={b.id}>{b.bank_name}</option>)}
              </select>
            </div>
            <div className="flex gap-sm justify-end">
              <button
                onClick={() => setShowAddForm(false)}
                className="text-body-sm text-on-surface-variant hover:text-on-surface px-3 py-1"
              >
                Cancelar
              </button>
              <button
                onClick={addCustomSuggestion}
                disabled={!newSuggConcept.trim()}
                className="text-body-sm bg-primary text-primary-on px-3 py-1 rounded-md disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        )}

        {(() => {
          const autoVisible = commonTransactions.filter(t => !hiddenConcepts.has(t.concept));
          const allItems = [...customSuggestions, ...autoVisible];
          if (allItems.length === 0) {
            return <p className="text-body-sm text-on-surface-variant">Aún no hay sugerencias</p>;
          }
          return (
            <div className="space-y-sm">
              {allItems.map((t, i) => (
                <div
                  key={`${t.concept}-${i}`}
                  className="flex items-center gap-md p-sm bg-surface-container-highest/50 rounded-lg hover:bg-surface-container-highest transition-colors group"
                >
                  <div
                    className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center shrink-0 cursor-pointer"
                    onClick={() => handleQuickSuggestion(t)}
                  >
                    <span className="material-symbols-outlined text-on-primary-container text-[18px]">
                      {CATEGORY_ICONS[t.group] || "receipt"}
                    </span>
                  </div>
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => handleQuickSuggestion(t)}
                  >
                    <p className="text-body-md font-semibold truncate">{t.concept}</p>
                    <p className="text-label-caps text-[10px] text-on-surface-variant">
                      {t.bank_name || "Sin banco"} · {t.group} · {t.type}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (customSuggestions.some(s => s.concept === t.concept)) {
                        removeCustomSuggestion(t.concept);
                      } else {
                        toggleHideConcept(t.concept);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-on-surface-variant hover:text-error rounded-full hover:bg-surface-container-high"
                    title="Eliminar sugerencia"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}