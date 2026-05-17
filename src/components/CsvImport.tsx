"use client";

import { useState } from "react";

interface ImportRow {
  date?: string;
  concept?: string;
  amount?: number;
  group?: string;
  type?: string;
  pattern?: string;
}

interface ImportResult {
  created: number;
  errors: string[];
  results: ImportRow[];
}

export default function CsvImport() {
  const [separator, setSeparator] = useState(";");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setResult(null);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("separator", separator);

    try {
      const res = await fetch("/api/mapping-rules/import", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error del servidor");
      } else {
        setResult(data);
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex gap-md mb-lg">
        <div className="w-20">
          <label className="text-label-caps text-on-surface-variant uppercase block mb-1">Separador</label>
          <input
            type="text"
            value={separator}
            onChange={(e) => setSeparator(e.target.value)}
            className="w-full bg-surface-container-high rounded-lg px-md py-md text-body-md text-on-surface border border-outline-variant focus:border-primary focus:outline-none"
            maxLength={2}
          />
        </div>
      </div>

      <p className="text-body-sm text-on-surface-variant mb-lg">
        Columnas requeridas: <code className="text-primary">concepto;tipo;categoria</code>
      </p>

      <div className="flex gap-md items-center">
        <div className="flex-1">
          <label className="text-label-caps text-on-surface-variant uppercase block mb-1">Archivo CSV</label>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
              setError("");
            }}
            className="w-full text-body-md text-on-surface file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-primary-on file:cursor-pointer hover:file:opacity-90"
          />
        </div>
        <button
          onClick={handleImport}
          disabled={loading || !file}
          className="bg-primary text-primary-on px-lg py-md rounded-lg text-label-caps hover:opacity-90 disabled:opacity-50 self-end"
        >
          {loading ? "Importando..." : "Importar"}
        </button>
      </div>

      {error && (
        <p className="mt-md text-body-sm text-error bg-error-container/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {result && (result.errors?.length ?? 0) === 0 && (
        <p className="mt-md text-body-sm text-primary">
          {result.created} regla{result.created !== 1 ? "s" : ""} importada{result.created !== 1 ? "s" : ""}
        </p>
      )}

      {(result?.errors?.length ?? 0) > 0 && (
        <div className="mt-md space-y-1">
          {result?.errors?.map((err, i) => (
            <p key={i} className="text-body-sm text-error">{err}</p>
          ))}
        </div>
      )}

      {(result?.results?.length ?? 0) > 0 && (
        <div className="mt-md max-h-48 overflow-y-auto">
          <table className="w-full text-left text-data-mono">
            <thead>
              <tr className="text-on-surface-variant border-b border-outline-variant">
                <th className="py-sm text-label-caps pr-4">Patrón</th>
                <th className="py-sm text-label-caps pr-4">Tipo</th>
                <th className="py-sm text-label-caps">Categoría</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {result?.results?.map((r, i) => (
                <tr key={i}>
                  <td className="py-md text-primary pr-4">{r.pattern}</td>
                  <td className="py-md text-on-surface pr-4">{r.type}</td>
                  <td className="py-md text-on-surface">{r.group}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
