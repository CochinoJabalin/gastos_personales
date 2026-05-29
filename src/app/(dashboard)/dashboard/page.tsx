import { headers, cookies } from "next/headers";
import DashboardContent from "./DashboardContent";

export default async function DashboardPage() {
  const headersList = await headers();
  const cookieStore = await cookies();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const origin = `${protocol}://${host}`;

  const allCookies = cookieStore.getAll();
  const cookieHeader = allCookies.map((c) => `${c.name}=${c.value}`).join("; ");

  const currentYear = new Date().getFullYear();

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

  const [
    summary,
    matrix,
    banks,
    investments,
    investmentGoals,
    budgetConfig,
    yearsData,
  ] = await Promise.all([
    safeFetch<any>(`/api/dashboard/summary?year=${currentYear}`, null),
    safeFetch<any>(`/api/dashboard/matrix?year=${currentYear}`, null),
    safeFetch<any[]>("/api/banks", []),
    safeFetch<any>("/api/investments/summary", null),
    safeFetch<any>("/api/investments/goals", null),
    safeFetch<{ necessities: string[]; desires: string[] }>("/api/budget-categories", { necessities: [], desires: [] }),
    safeFetch<{ years: number[] }>("/api/transactions/years", { years: [] }),
  ]);

  const availableYears = yearsData.years || [];
  let selectedYear = currentYear;
  if (availableYears.length > 0 && !availableYears.includes(currentYear)) {
    selectedYear = availableYears[availableYears.length - 1];
  }

  return (
    <DashboardContent
      initialData={{
        summary,
        matrix,
        banks: banks || [],
        investments,
        investmentGoals,
        budgetConfig,
        availableYears,
        selectedYear,
      }}
    />
  );
}
