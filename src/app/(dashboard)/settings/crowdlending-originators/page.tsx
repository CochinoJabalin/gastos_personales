"use client";

import { useState, useEffect } from "react";

interface Originator {
  id: string;
  name: string;
  created_at: string;
}

export default function CrowdlendingOriginatorsPage() {
  const [originators, setOriginators] = useState<Originator[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");

  function fetchOriginators() {
    fetch("/api/crowdlending/originators")
      .then((r) => r.json())
      .then(setOriginators)
      .catch(() => {});
  }

  useEffect(() => {
    fetchOriginators();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!newName.trim()) return;
    const res = await fetch("/api/crowdlending/originators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al crear");
      return;
    }
    setNewName("");
    fetchOriginators();
  }

  async function handleUpdate(id: string) {
    setError("");
    if (!editName.trim()) return;
    const res = await fetch(`/api/crowdlending/originators/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al actualizar");
      return;
    }
    setEditingId(null);
    setEditName("");
    fetchOriginators();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este originador?")) return;
    const res = await fetch(`/api/crowdlending/originators/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al eliminar");
      return;
    }
    fetchOriginators();
  }

  return (
    <div className="space-y-lg">
      <div>
        <h2 className="text-headline-md text-on-surface">Originadores de Crowdlending</h2>
        <p className="text-body-sm text-on-surface-variant mt-xs">
          Gestiona los originadores utilizados en las inversiones de crowdlending.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex gap-sm items-end">
        <div className="flex-1 space-y-xs">
          <label className="text-label-caps text-on-surface-variant uppercase">
            Nuevo originador
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del originador"
            className="w-full bg-surface-container-high rounded-lg px-md py-md text-body-md text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          disabled={!newName.trim()}
          className="bg-primary text-primary-on px-lg py-md rounded-lg text-body-sm font-medium disabled:opacity-50"
        >
          Añadir
        </button>
      </form>

      {error && (
        <div className="bg-error/10 text-error text-body-sm px-md py-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-surface-container-high text-label-caps text-on-surface-variant">
              <th className="p-md">Nombre</th>
              <th className="p-md">Creado</th>
              <th className="p-md w-40">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {originators.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-lg text-center text-on-surface-variant text-body-sm">
                  No hay originadores
                </td>
              </tr>
            ) : (
              originators.map((o) => (
                <tr key={o.id} className="hover:bg-surface-container-low transition-colors">
                  {editingId === o.id ? (
                    <>
                      <td className="p-md">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="bg-surface-container-high rounded px-2 py-1 text-body-sm text-on-surface border border-outline-variant w-full"
                        />
                      </td>
                      <td className="p-md text-body-sm text-on-surface-variant">
                        {new Date(o.created_at).toLocaleDateString("es")}
                      </td>
                      <td className="p-md">
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleUpdate(o.id)}
                            className="text-primary hover:underline text-body-sm"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => { setEditingId(null); setEditName(""); }}
                            className="text-on-surface-variant hover:text-on-surface text-body-sm"
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-md text-on-surface font-medium">{o.name}</td>
                      <td className="p-md text-body-sm text-on-surface-variant">
                        {new Date(o.created_at).toLocaleDateString("es")}
                      </td>
                      <td className="p-md">
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEditingId(o.id); setEditName(o.name); }}
                            className="text-primary hover:underline text-body-sm"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(o.id)}
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
  );
}
