import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";

  const results = await prisma.$queryRaw<Array<{ concept: string; count: number }>>`
    SELECT "concept", COUNT(*)::int as "count"
    FROM "Transaction"
    WHERE LOWER("concept") LIKE ${"%" + q.toLowerCase() + "%"}
    GROUP BY "concept"
    ORDER BY "count" DESC
    LIMIT 20
  `;

  return NextResponse.json(results);
}
