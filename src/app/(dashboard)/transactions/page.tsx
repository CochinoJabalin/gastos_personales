import { headers, cookies } from "next/headers";
import TransactionsContent from "./TransactionsContent";

export default async function TransactionsPage() {
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

  const currentYear = new Date().getFullYear().toString();

  const [banks, yearsData, categories, txData, groupsData] = await Promise.all([
    safeFetch<any[]>("/api/banks", []),
    safeFetch<{ years: string[] }>("/api/transactions/years", { years: [] }),
    safeFetch<string[]>("/api/categories", []),
    safeFetch<{ data: any[] }>(`/api/transactions?year=${currentYear}&limit=100`, { data: [] }),
    safeFetch<{ group: string; type: string; count: number }[]>("/api/transactions/groups", []),
  ]);

  return (
    <TransactionsContent
      initialBanks={banks}
      initialYears={yearsData.years || []}
      initialCategories={categories}
      initialTransactions={txData.data || []}
      initialGroups={groupsData}
    />
  );
}
