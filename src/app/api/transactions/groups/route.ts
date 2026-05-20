import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const results = await prisma.$queryRaw<
    Array<{ group: string; type: string; count: number }>
  >`
    SELECT "group" as "group", "type" as "type", COUNT(*)::int as "count"
    FROM "Transaction"
    GROUP BY "group", "type"
    ORDER BY "count" DESC
  `;

  return NextResponse.json(results);
}
