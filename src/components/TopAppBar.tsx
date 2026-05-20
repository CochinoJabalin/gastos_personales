"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/matrix", label: "Matriz", icon: "grid_3x3" },
  { href: "/transactions", label: "Operaciones", icon: "receipt_long" },
  { href: "/investments", label: "Inversiones", icon: "trending_up" },
  { href: "/crowdlending", label: "Crowdlending", icon: "account_balance" },
  { href: "/quick-entry", label: "Rápido", icon: "add_circle" },
  { href: "/settings", label: "Ajustes", icon: "settings" },
];

export default function TopAppBar() {
  const pathname = usePathname();
  const [mobileOnlyNav, setMobileOnlyNav] = useState(false);

  useEffect(() => {
    const check = () => setMobileOnlyNav(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const quickEntryItem = navItems.find((i) => i.href === "/quick-entry")!;
  const mobileNavItems = mobileOnlyNav ? [quickEntryItem] : navItems;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-surface-dim/80 backdrop-blur-md border-b border-surface-container-high">
        <div className="flex items-center justify-between px-container-margin h-14">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-on-surface-variant">
              account_balance
            </span>
            <h1 className="text-body-md font-semibold text-on-surface">
              Gestor Patrimonial
            </h1>
          </div>
          <button
            onClick={() => signOut()}
            className="text-body-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Salir
          </button>
        </div>
      </header>

      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 z-30 w-56 flex-col bg-surface-container-low border-r border-surface-container-high pt-14">
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-body-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                <span className="material-symbols-outlined text-xl">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-container-low border-t border-surface-container-high">
        <div className="flex items-center justify-center h-16 px-2">
          {mobileNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-on-surface-variant"
                }`}
              >
                <span className="material-symbols-outlined text-2xl">
                  {item.icon}
                </span>
                <span className="text-label-caps">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

