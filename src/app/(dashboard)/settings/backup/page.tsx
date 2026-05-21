"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface BackupSchedule {
  id: string;
  name: string;
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  time: string;
  enabled: boolean;
  path: string | null;
  lastRun: string | null;
  nextRun: string | null;
  createdAt: string;
}

interface BackupLog {
  id: string;
  scheduleId: string | null;
  filename: string;
  size: number;
  stats: string;
  createdAt: string;
  schedule: { name: string } | null;
}

interface RestoreResult {
  success: boolean;
  summary?: {
    restored: Record<string, number>;
    skipped: Record<string, number>;
  };
  error?: string;
}

const FREQUENCIES = [
  { value: "daily", label: "Diario" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
];

export default function BackupSettingsPage() {
  const pathname = usePathname();
  const [backupPath, setBackupPath] = useState("/backups");
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const [newSchedule, setNewSchedule] = useState({
    name: "",
    frequency: "daily",
    dayOfWeek: 1,
    dayOfMonth: 1,
    time: "02:00",
    path: "",
  });

  const [runningManual, setRunningManual] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [restoringFromFile, setRestoringFromFile] = useState(false);

  const subNavItems = [
    { href: "/settings", label: "General", icon: "settings" },
    { href: "/settings/banks", label: "Bancos", icon: "account_balance" },
    { href: "/settings/mapping-rules", label: "Mapeos", icon: "rule" },
    { href: "/settings/import", label: "Importar", icon: "upload" },
    { href: "/settings/backup", label: "Backup", icon: "backup" },
  ];

  const fetchData = useCallback(async () => {
    const [configRes, schedulesRes, logsRes] = await Promise.all([
      fetch("/api/backup/config"),
      fetch("/api/backup/schedules"),
      fetch("/api/backup/logs"),
    ]);
    const config = await configRes.json();
    const schedulesData = await schedulesRes.json();
    const logsData = await logsRes.json();

    setBackupPath(config.backupPath);
    setSchedules(Array.isArray(schedulesData) ? schedulesData : []);
    setLogs(Array.isArray(logsData) ? logsData : []);
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  async function saveConfig() {
    await fetch("/api/backup/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ backupPath }),
    });
  }

  async function addSchedule() {
    if (!newSchedule.name || !newSchedule.time) return;

    await fetch("/api/backup/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newSchedule,
        path: newSchedule.path || null,
      }),
    });

    setShowAddForm(false);
    setNewSchedule({
      name: "",
      frequency: "daily",
      dayOfWeek: 1,
      dayOfMonth: 1,
      time: "02:00",
      path: "",
    });
    fetchData();
  }

  async function toggleSchedule(id: string, enabled: boolean) {
    await fetch(`/api/backup/schedules/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    fetchData();
  }

  async function deleteSchedule(id: string) {
    if (!confirm("¿Eliminar esta programación?")) return;
    await fetch(`/api/backup/schedules/${id}`, { method: "DELETE" });
    fetchData();
  }

  async function runSchedule(id: string) {
    const res = await fetch(`/api/backup/schedules/${id}/run`, { method: "POST" });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "backup.zip";
      a.click();
      URL.revokeObjectURL(url);
    }
    fetchData();
  }

  async function runManual() {
    setRunningManual(true);
    try {
      const res = await fetch("/api/backup/run", {
        method: "POST",
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "backup.zip";
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setRunningManual(false);
      fetchData();
    }
  }

  async function downloadLog(id: string) {
    const res = await fetch(`/api/backup/logs/${id}/download`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "backup.zip";
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  async function handleRestore(logId: string) {
    if (!confirm("¿Restaurar desde este backup? Los datos existentes no se sobrescribirán.")) return;

    setRestoringId(logId);
    setRestoreResult(null);

    try {
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId }),
      });
      const result = await res.json();
      setRestoreResult(result);
    } catch {
      setRestoreResult({ success: false, error: "Error de conexión" });
    } finally {
      setRestoringId(null);
      fetchData();
    }
  }

  async function handleRestoreFromFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".zip")) {
      setRestoreResult({ success: false, error: "El archivo debe ser un .zip" });
      return;
    }

    if (!confirm("¿Restaurar desde este archivo? Los datos existentes no se sobrescribirán.")) {
      event.target.value = "";
      return;
    }

    setRestoringFromFile(true);
    setRestoreResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/backup/restore", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      setRestoreResult(result);
    } catch {
      setRestoreResult({ success: false, error: "Error de conexión" });
    } finally {
      setRestoringFromFile(false);
      event.target.value = "";
      fetchData();
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(str: string): string {
    return new Date(str).toLocaleString("es-ES");
  }

  if (loading) {
    return (
      <div className="space-y-lg">
        <div className="flex gap-2 border-b border-outline-variant pb-lg">
          {subNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/settings" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
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
        <div className="text-center text-on-surface-variant py-xl">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      <div className="flex gap-2 border-b border-outline-variant pb-lg overflow-x-auto">
        {subNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/settings" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2 px-lg py-md rounded-lg text-body-sm transition-colors whitespace-nowrap ${
                isActive ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              }`}
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>

      <h1 className="text-headline-md text-on-surface">Backup</h1>

      {/* Global Config */}
      <section className="bg-surface-container border border-outline-variant rounded-xl p-lg">
        <h2 className="text-label-caps text-on-surface-variant uppercase mb-md">Ruta Global de Backup</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={backupPath}
            onChange={(e) => setBackupPath(e.target.value)}
            className="bg-surface-container-high rounded px-3 py-2 text-body-sm text-on-surface border border-outline-variant flex-1"
          />
          <button
            onClick={saveConfig}
            className="px-lg py-md bg-primary text-on-primary rounded-lg text-body-sm"
          >
            Guardar
          </button>
        </div>
      </section>

      {/* Manual Backup */}
      <section className="bg-surface-container border border-outline-variant rounded-xl p-lg">
        <h2 className="text-label-caps text-on-surface-variant uppercase mb-md">Backup Manual</h2>
        <p className="text-body-sm text-on-surface-variant mb-md">
          Genera un backup completo de todos los datos (bancos, cuentas, operaciones, transferencias, inversiones, crowdlending, reglas de mapeo).
        </p>
        <button
          onClick={runManual}
          disabled={runningManual}
          className="flex items-center gap-2 px-lg py-md bg-black text-white rounded-lg text-body-sm hover:bg-black/80 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">backup</span>
          {runningManual ? "Generando..." : "Ejecutar Backup Completo"}
        </button>
      </section>

      {/* Restore from File */}
      <section className="bg-surface-container border border-outline-variant rounded-xl p-lg">
        <h2 className="text-label-caps text-on-surface-variant uppercase mb-md">Restaurar desde Archivo</h2>
        <p className="text-body-sm text-on-surface-variant mb-md">
          Sube un archivo de backup (.zip) para restaurar los datos. Los registros existentes no se sobrescribirán.
        </p>
        <label
          className={`flex items-center gap-2 px-lg py-md bg-positive text-white rounded-lg text-body-sm hover:bg-positive/80 cursor-pointer inline-flex ${restoringFromFile ? "opacity-50 pointer-events-none" : ""}`}
        >
          <span className="material-symbols-outlined text-lg">restore</span>
          {restoringFromFile ? "Restaurando..." : "Seleccionar Archivo ZIP"}
          <input
            type="file"
            accept=".zip"
            onChange={handleRestoreFromFile}
            disabled={restoringFromFile}
            className="hidden"
          />
        </label>
      </section>

      {/* Restore Result Modal */}
      {restoreResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-lg max-w-lg w-full mx-4 shadow-xl">
            <h2 className="text-headline-sm text-on-surface mb-md">
              {restoreResult.success ? "Restauración completada" : "Error en restauración"}
            </h2>
            {restoreResult.success && restoreResult.summary ? (
              <div className="space-y-sm">
                <p className="text-body-sm text-on-surface-variant">Resumen de la restauración:</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-positive/10 rounded-lg p-md">
                    <p className="text-label-caps text-positive">Restaurados</p>
                    {Object.entries(restoreResult.summary.restored).map(([key, count]) => (
                      count > 0 && (
                        <p key={key} className="text-body-sm text-on-surface">
                          {key}: {count}
                        </p>
                      )
                    ))}
                    {Object.values(restoreResult.summary.restored).every(v => v === 0) && (
                      <p className="text-body-sm text-on-surface-variant">Ninguno</p>
                    )}
                  </div>
                  <div className="bg-warning/10 rounded-lg p-md">
                    <p className="text-label-caps text-warning">Omitidos (duplicados)</p>
                    {Object.entries(restoreResult.summary.skipped).map(([key, count]) => (
                      count > 0 && (
                        <p key={key} className="text-body-sm text-on-surface">
                          {key}: {count}
                        </p>
                      )
                    ))}
                    {Object.values(restoreResult.summary.skipped).every(v => v === 0) && (
                      <p className="text-body-sm text-on-surface-variant">Ninguno</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-body-sm text-error">{restoreResult.error}</p>
            )}
            <button
              onClick={() => setRestoreResult(null)}
              className="mt-md px-lg py-md bg-primary text-on-primary rounded-lg text-body-sm w-full"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Schedules */}
      <section className="bg-surface-container border border-outline-variant rounded-xl p-lg">
        <div className="flex justify-between items-center mb-md">
          <h2 className="text-label-caps text-on-surface-variant uppercase">Programaciones</h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-lg py-md bg-black text-white rounded-lg text-body-sm hover:bg-black/80"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Nueva
          </button>
        </div>

        {showAddForm && (
          <div className="bg-surface-container-high border border-outline-variant rounded-lg p-md mb-md">
            <h3 className="text-body-md font-semibold text-on-surface mb-md">Nueva Programación</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md">
              <input
                type="text"
                placeholder="Nombre"
                value={newSchedule.name}
                onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
                className="bg-surface-container-high rounded px-3 py-2 text-body-sm text-on-surface border border-outline-variant"
              />
              <select
                value={newSchedule.frequency}
                onChange={(e) => setNewSchedule({ ...newSchedule, frequency: e.target.value })}
                className="bg-surface-container-high rounded px-3 py-2 text-body-sm text-on-surface border border-outline-variant"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              {newSchedule.frequency === "weekly" && (
                <select
                  value={newSchedule.dayOfWeek}
                  onChange={(e) => setNewSchedule({ ...newSchedule, dayOfWeek: Number(e.target.value) })}
                  className="bg-surface-container-high rounded px-3 py-2 text-body-sm text-on-surface border border-outline-variant"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              )}
              {newSchedule.frequency === "monthly" && (
                <input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Día del mes"
                  value={newSchedule.dayOfMonth}
                  onChange={(e) => setNewSchedule({ ...newSchedule, dayOfMonth: Number(e.target.value) })}
                  className="bg-surface-container-high rounded px-3 py-2 text-body-sm text-on-surface border border-outline-variant"
                />
              )}
              <input
                type="time"
                value={newSchedule.time}
                onChange={(e) => setNewSchedule({ ...newSchedule, time: e.target.value })}
                className="bg-surface-container-high rounded px-3 py-2 text-body-sm text-on-surface border border-outline-variant"
              />
              <input
                type="text"
                placeholder="Ruta (opcional)"
                value={newSchedule.path}
                onChange={(e) => setNewSchedule({ ...newSchedule, path: e.target.value })}
                className="bg-surface-container-high rounded px-3 py-2 text-body-sm text-on-surface border border-outline-variant"
              />
            </div>
            <div className="flex gap-2 mt-md">
              <button onClick={addSchedule} className="px-lg py-md bg-primary text-on-primary rounded-lg text-body-sm">Guardar</button>
              <button onClick={() => setShowAddForm(false)} className="px-lg py-md bg-surface-container-high text-on-surface-variant rounded-lg text-body-sm">Cancelar</button>
            </div>
          </div>
        )}

        {schedules.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant py-md">No hay programaciones creadas.</p>
        ) : (
          <div className="divide-y divide-outline-variant">
            {schedules.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-md">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-body-md font-medium text-on-surface">{s.name}</span>
                    <span className={`text-label-caps px-2 py-0.5 rounded-full text-xs ${
                      s.enabled ? "bg-primary/10 text-primary" : "bg-surface-container-high text-on-surface-variant"
                    }`}>
                      {s.enabled ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <div className="text-body-sm text-on-surface-variant mt-xs">
                    {s.frequency === "daily" && "Diario"}
                    {s.frequency === "weekly" && `Semanal (${DAYS_OF_WEEK.find(d => d.value === s.dayOfWeek)?.label})`}
                    {s.frequency === "monthly" && `Mensual (día ${s.dayOfMonth})`}
                    {" — "}{s.time}
                    {s.path && ` — Ruta: ${s.path}`}
                  </div>
                  {(s.lastRun || s.nextRun) && (
                    <div className="text-body-xs text-on-surface-variant mt-xs">
                      {s.lastRun && <>Último: {formatDate(s.lastRun)}</>}
                      {s.lastRun && s.nextRun && " | "}
                      {s.nextRun && <>Próximo: {formatDate(s.nextRun)}</>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => runSchedule(s.id)}
                    className="text-primary hover:text-primary/80 p-1"
                    title="Ejecutar ahora"
                  >
                    <span className="material-symbols-outlined text-lg">play_arrow</span>
                  </button>
                  <button
                    onClick={() => toggleSchedule(s.id, s.enabled)}
                    className={`p-1 ${s.enabled ? "text-primary" : "text-on-surface-variant"} hover:text-on-surface`}
                    title={s.enabled ? "Desactivar" : "Activar"}
                  >
                    <span className="material-symbols-outlined text-lg">{s.enabled ? "toggle_on" : "toggle_off"}</span>
                  </button>
                  <button
                    onClick={() => deleteSchedule(s.id)}
                    className="text-error hover:text-error/80 p-1"
                    title="Eliminar"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* History */}
      <section className="bg-surface-container border border-outline-variant rounded-xl p-lg">
        <h2 className="text-label-caps text-on-surface-variant uppercase mb-md">Historial</h2>
        {logs.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant py-md">No hay backups registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-high text-label-caps text-on-surface-variant">
                  <th className="p-md">Fecha</th>
                  <th className="p-md">Archivo</th>
                  <th className="p-md">Tamaño</th>
                  <th className="p-md">Programación</th>
                  <th className="p-md w-44">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {logs.map((log) => {
                  let stats: Record<string, number> = {};
                  try { stats = JSON.parse(log.stats); } catch {}
                  const totalItems = Object.values(stats).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={log.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="p-md text-body-sm text-on-surface">{formatDate(log.createdAt)}</td>
                      <td className="p-md text-body-sm text-on-surface font-medium">{log.filename}</td>
                      <td className="p-md text-body-sm text-on-surface-variant">{formatSize(log.size)}</td>
                      <td className="p-md text-body-sm text-on-surface-variant">
                        {log.schedule?.name ?? "Manual"}
                        <span className="text-body-xs text-on-surface-variant ml-1">
                          ({totalItems} registros)
                        </span>
                      </td>
                      <td className="p-md">
                        <div className="flex gap-1">
                          <button
                            onClick={() => downloadLog(log.id)}
                            className="text-primary hover:text-primary/80 p-1"
                            title="Descargar"
                          >
                            <span className="material-symbols-outlined text-lg">download</span>
                          </button>
                          <button
                            onClick={() => handleRestore(log.id)}
                            disabled={restoringId === log.id}
                            className="text-positive hover:text-positive/80 p-1 disabled:opacity-50"
                            title="Restaurar"
                          >
                            <span className="material-symbols-outlined text-lg">
                              {restoringId === log.id ? "hourglass_top" : "restore"}
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
