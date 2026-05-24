"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import CsvImport from "@/components/CsvImport";
import TransactionsImport from "@/components/TransactionsImport";
import InvestmentsImport from "@/components/InvestmentsImport";
import InvestmentsDividendsImport from "@/components/InvestmentsDividendsImport";

export default function ImportSettingsPage() {
  const pathname = usePathname();

  const subNavItems = [
    { href: "/settings", label: "General", icon: "settings" },
    { href: "/settings/banks", label: "Bancos", icon: "account_balance" },
    { href: "/settings/mapping-rules", label: "Mapeos", icon: "rule" },
    { href: "/settings/import", label: "Importar", icon: "upload" },
    { href: "/settings/backup", label: "Backup", icon: "backup" },
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
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

      <section className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
        <div className="p-lg border-b border-outline-variant">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary">trending_up</span>
            <h3 className="text-headline-md text-on-surface">Inversiones</h3>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Importar operaciones de compra/venta desde CSV. Columnas requeridas:{" "}
            <code className="text-primary">Fecha;Operación;Descripción;ISIN;Títulos;Importe;Divisa</code>
          </p>
        </div>
        <div className="p-lg">
          <InvestmentsImport />
        </div>
      </section>

      <section className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
        <div className="p-lg border-b border-outline-variant">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-positive">payments</span>
            <h3 className="text-headline-md text-on-surface">Dividendos</h3>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Importar dividendos desde CSV con retenciones para IRPF. Columnas requeridas:{" "}
            <code className="text-primary">Fecha;ISIN/Ticker;Nombre;Títulos;Bruto;Retención;Neto €</code>
          </p>
        </div>
        <div className="p-lg">
          <InvestmentsDividendsImport />
        </div>
      </section>

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
          <button
            onClick={async () => {
              if (!confirm("¿Vaciar TODAS las inversiones (operaciones, lotes, holdings e instrumentos)?")) return;
              await fetch("/api/investments/clear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "all" }) });
              alert("Inversiones eliminadas");
            }}
            className="px-lg py-md bg-error/10 text-error rounded-xl border border-error/30 hover:bg-error/20 transition-colors text-body-sm font-semibold"
          >
            Vaciar Inversiones
          </button>
          <button
            onClick={async () => {
              if (!confirm("¿Vaciar todos los dividendos?")) return;
              await fetch("/api/investments/clear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "dividends" }) });
              alert("Dividendos eliminados");
            }}
            className="px-lg py-md bg-error/10 text-error rounded-xl border border-error/30 hover:bg-error/20 transition-colors text-body-sm font-semibold"
          >
            Vaciar Dividendos
          </button>
        </div>
      </section>
    </div>
  );
}
