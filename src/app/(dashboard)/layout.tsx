"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import TopAppBar from "@/components/TopAppBar";
import AuthGuard from "@/components/AuthGuard";
import BankOnboarding from "@/components/BankOnboarding";
import { ViewProvider } from "@/lib/ViewContext";
import { ThemeProvider } from "@/lib/theme";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [hasBanks, setHasBanks] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (window.innerWidth < 768 && pathname !== "/quick-entry") {
      router.replace("/quick-entry");
    }
  }, [pathname, router]);

  function checkBanks() {
    setChecking(true);
    fetch("/api/banks")
      .then((r) => r.json())
      .then((data) => {
        setHasBanks(Array.isArray(data) && data.length > 0);
      })
      .catch(() => setHasBanks(false))
      .finally(() => setChecking(false));
  }

  useEffect(() => {
    checkBanks();
  }, []);

  if (checking) {
    return (
      <ThemeProvider>
        <div className="min-h-screen flex items-center justify-center bg-surface">
          <div className="text-on-surface-variant text-body-md">Cargando...</div>
        </div>
      </ThemeProvider>
    );
  }

  if (hasBanks === false) {
    return (
      <ThemeProvider>
        <SessionProvider>
          <AuthGuard>
            <BankOnboarding onComplete={checkBanks} />
          </AuthGuard>
        </SessionProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SessionProvider>
        <AuthGuard>
          <ViewProvider>
            <TopAppBar />
            <main className="md:ml-56 pt-14 pb-20 md:pb-6 min-h-screen bg-surface">
              <div className="max-w-7xl mx-auto px-container-margin py-4 space-y-4">
                {children}
              </div>
            </main>
          </ViewProvider>
        </AuthGuard>
      </SessionProvider>
    </ThemeProvider>
  );
}
