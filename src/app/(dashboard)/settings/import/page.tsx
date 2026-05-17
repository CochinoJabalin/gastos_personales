"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import CsvImport from "@/components/CsvImport";
import TransactionsImport from "@/components/TransactionsImport";

export default function ImportSettingsPage() {
  const pathname = usePathname();

  const subNavItems = [
    { href: "/settings", label: "General", icon: "settings" },
    { href: "/settings/mapping-rules", label: "Mapeos", icon: "rule" },
    { href: "/settings/import", label: "Importar", icon: "upload" },
  ];

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

      <h1 className="text-headline-md text-on-surface">Importar</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        <section className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
          <div className="p-lg border-b border-outline-variant">
            <h3 className="text-headline-md text-on-surface">Reglas de Mapeo</h3>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Subí un CSV con las columnas: <code className="text-primary">concepto;tipo;categoria</code>
            </p>
          </div>
          <div className="p-lg">
            <CsvImport />
          </div>
        </section>

        <section className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
          <div className="p-lg border-b border-outline-variant">
            <h3 className="text-headline-md text-on-surface">Transacciones</h3>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Subí un CSV con las columnas: <code className="text-primary">fecha;banco;concepto;comentarios;importe</code>
            </p>
          </div>
          <div className="p-lg">
            <TransactionsImport />
          </div>
        </section>
      </div>

      <section className="bg-surface-container border border-outline-variant rounded-xl p-lg">
        <div className="flex items-center gap-sm mb-md">
          <span className="material-symbols-outlined text-error">warning</span>
          <h3 className="text-headline-md text-on-surface">Zona de Peligro</h3>
        </div>
        <p className="text-body-sm text-on-surface-variant mb-md">
          Estas acciones son irreversibles.
        </p>
        <div className="flex flex-wrap gap-md">
          <button
            onClick={async () => {
              if (!confirm("¿Vaciar todas las transacciones?")) return;
              await fetch("/api/transactions/clear", { method: "POST" });
              alert("Transacciones eliminadas");
            }}
            className="px-lg py-md bg-error/10 text-error rounded-xl border border-error/30 hover:bg-error/20 transition-colors text-body-sm font-semibold"
          >
            Vaciar Transacciones
          </button>
          <button
            onClick={async () => {
              if (!confirm("¿Vaciar todas las reglas de mapeo?")) return;
              await fetch("/api/mapping-rules/clear", { method: "POST" });
              alert("Reglas de mapeo eliminadas");
            }}
            className="px-lg py-md bg-error/10 text-error rounded-xl border border-error/30 hover:bg-error/20 transition-colors text-body-sm font-semibold"
          >
            Vaciar Reglas de Mapeo
          </button>
        </div>
      </section>
    </div>
  );
}
