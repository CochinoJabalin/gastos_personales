"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BankManager from "@/components/BankManager";

interface Bank {
  id: string;
  bank_name: string;
  account_label: string;
}

export default function SettingsPage() {
  const pathname = usePathname();
  const [banks, setBanks] = useState<Bank[]>([]);

  useEffect(() => {
    fetch("/api/banks").then((r) => r.json()).then(setBanks).catch(() => {});
  }, []);

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
      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
        {/* Server Status */}
        <section className="md:col-span-4 bg-surface-container border border-outline-variant p-lg rounded-xl flex flex-col gap-md">
          <div className="flex justify-between items-start">
            <span className="text-label-caps text-on-surface-variant uppercase">Estado del Servidor</span>
            <span className="material-symbols-outlined text-primary">dns</span>
          </div>
          <div className="mt-auto">
            <h2 className="text-headline-md text-on-surface">Servidor Activo</h2>
            <div className="flex items-center gap-sm mt-xs">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-body-sm text-on-surface-variant">Latencia Estable</span>
            </div>
          </div>
        </section>

        {/* Security Policy */}
        <section className="md:col-span-4 bg-surface-container border border-outline-variant p-lg rounded-xl flex flex-col gap-md">
          <div className="flex justify-between items-start">
            <span className="text-label-caps text-on-surface-variant uppercase">Política de Seguridad</span>
            <span className="material-symbols-outlined text-primary">shield</span>
          </div>
          <div className="mt-auto">
            <h2 className="text-body-md font-semibold text-on-surface">Zero Local Storage</h2>
            <p className="text-body-sm text-on-surface-variant mt-xs">Soberanía de Datos Activa</p>
          </div>
        </section>

        {/* Version */}
        <section className="md:col-span-4 bg-surface-container-high border border-outline-variant p-lg rounded-xl flex items-center justify-between">
          <div className="flex flex-col gap-xs">
            <span className="text-label-caps text-on-surface-variant uppercase">Versión</span>
            <span className="text-data-mono text-primary">v0.1.0-DEV</span>
          </div>
          <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary-container">update</span>
          </div>
        </section>

        {/* Bancos */}
        <section className="md:col-span-4 bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
          <div className="p-lg">
            <BankManager banks={banks} onBankAdded={() => fetch("/api/banks").then((r) => r.json()).then(setBanks)} />
          </div>
        </section>
      </div>
    </div>
  );
}