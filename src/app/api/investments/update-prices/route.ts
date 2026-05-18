import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const instruments = await prisma.investmentInstrument.findMany({
    where: { ticker: { not: "" } },
  });

  const results: { ticker: string; success: boolean; price?: number; error?: string }[] = [];

  for (const inst of instruments) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${inst.ticker}?interval=1d&range=1d`;
      const res = await fetch(url);
      if (!res.ok) {
        results.push({ ticker: inst.ticker, success: false, error: `HTTP ${res.status}` });
        continue;
      }

      const data = await res.json();
      const result = data.chart?.result?.[0];
      if (!result) {
        results.push({ ticker: inst.ticker, success: false, error: "No data" });
        continue;
      }

      const meta = result.meta;
      const price = meta?.regularMarketPrice;
      const currency = meta?.currency;

      if (price == null) {
        results.push({ ticker: inst.ticker, success: false, error: "No price" });
        continue;
      }

      let exchangeRate = 1;
      if (currency && currency !== "EUR") {
        try {
          const fxUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${currency}EUR=X?interval=1d&range=1d`;
          const fxRes = await fetch(fxUrl);
          if (fxRes.ok) {
            const fxData = await fxRes.json();
            const fxMeta = fxData.chart?.result?.[0]?.meta;
            exchangeRate = fxMeta?.regularMarketPrice || 1;
          }
        } catch {
          exchangeRate = 1;
        }
      }

      await prisma.investmentInstrument.update({
        where: { id: inst.id },
        data: {
          current_price: price,
          exchange_rate_to_eur: exchangeRate,
          price_updated_at: new Date(),
        },
      });

      results.push({ ticker: inst.ticker, success: true, price });
    } catch (err) {
      results.push({ ticker: inst.ticker, success: false, error: String(err) });
    }
  }

  return NextResponse.json({ updated: results.filter((r) => r.success).length, failed: results.filter((r) => !r.success).length, results });
}
