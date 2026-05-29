import { headers, cookies } from "next/headers";
import TransfersContent from "./TransfersContent";

export default async function TransfersPage() {
  const headersList = await headers();
  const cookieStore = await cookies();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const origin = `${protocol}://${host}`;

  const allCookies = cookieStore.getAll();
  const cookieHeader = allCookies.map((c) => `${c.name}=${c.value}`).join("; ");

  async function safeFetch<T>(path: string, fallback: T): Promise<T> {
    try {
      const res = await fetch(`${origin}${path}`, {
        cache: "no-store",
        headers: cookieHeader ? { Cookie: cookieHeader } : {},
      });
      if (!res.ok) return fallback;
      return res.json() as Promise<T>;
    } catch {
      return fallback;
    }
  }

  const [accounts, transfersData, executionsData, autoTopup] = await Promise.all([
    safeFetch<any[]>("/api/accounts", []),
    safeFetch<{ data: any[] }>("/api/transfers?limit=100", { data: [] }),
    safeFetch<{ data: any[] }>("/api/transfers/executions?completed_limit=5&scheduled_limit=5", { data: [] }),
    safeFetch<any>("/api/auto-topup/config", null),
  ]);

  return (
    <TransfersContent
      initialAccounts={accounts}
      initialTransfers={transfersData.data || []}
      initialExecutions={executionsData.data || []}
      initialAutoTopup={autoTopup}
    />
  );
}
