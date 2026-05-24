import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Convert exchange prefix to Yahoo Finance suffix
function toYahooTicker(ticker: string): string {
  const upper = ticker.toUpperCase().trim();
  
  // Already has a suffix like .DE, .MC, .L
  if (upper.includes(".")) return upper;
  
  // Handle exchange prefixes
  if (upper.startsWith("NYSE:")) return upper.replace("NYSE:", "");
  if (upper.startsWith("NASDAQ:")) return upper.replace("NASDAQ:", "");
  if (upper.startsWith("ETR:")) return upper.replace("ETR:", "") + ".DE";
  if (upper.startsWith("BME:")) return upper.replace("BME:", "") + ".MC";
  if (upper.startsWith("LON:")) return upper.replace("LON:", "") + ".L";
  if (upper.startsWith("EPA:")) return upper.replace("EPA:", "") + ".PA";
  if (upper.startsWith("AMS:")) return upper.replace("AMS:", "") + ".AS";
  if (upper.startsWith("SWX:")) return upper.replace("SWX:", "") + ".SW";
  if (upper.startsWith("MIL:")) return upper.replace("MIL:", "") + ".MI";
  if (upper.startsWith("TSE:")) return upper.replace("TSE:", "") + ".T";
  if (upper.startsWith("HKG:")) return upper.replace("HKG:", "") + ".HK";
  
  return upper;
}

// Detect instrument type from Yahoo Finance data
function detectType(quoteType: string, shortName: string): string {
  const name = shortName.toUpperCase();
  if (name.includes("ETF")) return "ETF";
  if (name.includes("ETC") || name.includes("PHYSICAL")) return "ETC";
  if (quoteType === "ETF") return "ETF";
  if (quoteType === "MUTUALFUND") return "FUND";
  return "STOCK";
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Query debe tener al menos 2 caracteres" }, { status: 400 });
  }

  // First, search in local database
  const localResults = await prisma.investmentInstrument.findMany({
    where: {
      OR: [
        { ticker: { contains: query, mode: "insensitive" } },
        { isin: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 5,
  });

  const results: Array<{
    ticker: string;
    isin: string | null;
    name: string;
    currency: string;
    type: string;
    current_price: number | null;
    exchange_rate: number | null;
    source: "local" | "yahoo";
  }> = localResults.map((i) => ({
    ticker: i.ticker || "",
    isin: i.isin,
    name: i.name,
    currency: i.currency,
    type: i.type,
    current_price: i.current_price ? Number(i.current_price) : null,
    exchange_rate: i.exchange_rate_to_eur ? Number(i.exchange_rate_to_eur) : null,
    source: "local" as const,
  }));

  // If we have enough local results, return them
  if (results.length >= 5) {
    return NextResponse.json({ results });
  }

  // Search Yahoo Finance
  try {
    const yahooTicker = toYahooTicker(query);
    
    // Try Yahoo Finance search API
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(yahooTicker)}&quotesCount=5&newsCount=0`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const quotes = searchData.quotes || [];

      for (const quote of quotes) {
        // Skip if already in local results
        if (results.some((r) => r.ticker === quote.symbol)) continue;

        // Get detailed quote data
        const quoteUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${quote.symbol}?interval=1d&range=1d`;
        let currentPrice = null;
        let exchangeRate = 1;
        const currency = quote.currency || "USD";

        try {
          const quoteRes = await fetch(quoteUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          });
          
          if (quoteRes.ok) {
            const quoteData = await quoteRes.json();
            const meta = quoteData.chart?.result?.[0]?.meta;
            if (meta) {
              currentPrice = meta.regularMarketPrice || meta.previousClose;
            }
          }
        } catch {
          // Ignore price fetch errors
        }

        // Get exchange rate if not EUR
        if (currency !== "EUR") {
          try {
            const fxUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${currency}EUR=X?interval=1d&range=1d`;
            const fxRes = await fetch(fxUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              },
            });
            
            if (fxRes.ok) {
              const fxData = await fxRes.json();
              const fxMeta = fxData.chart?.result?.[0]?.meta;
              if (fxMeta) {
                exchangeRate = fxMeta.regularMarketPrice || fxMeta.previousClose || 1;
              }
            }
          } catch {
            // Ignore FX fetch errors
          }
        }

        results.push({
          ticker: quote.symbol,
          isin: null, // Yahoo doesn't provide ISIN
          name: quote.shortname || quote.longname || quote.symbol,
          currency,
          type: detectType(quote.quoteType || "", quote.shortname || ""),
          current_price: currentPrice,
          exchange_rate: exchangeRate,
          source: "yahoo",
        });

        if (results.length >= 10) break;
      }
    }
  } catch (err) {
    console.error("[Lookup] Yahoo Finance error:", err);
    // Continue with local results only
  }

  return NextResponse.json({ results });
}
