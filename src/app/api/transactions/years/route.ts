import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const currentYear = new Date().getFullYear();
  const years = await prisma.transaction.findMany({
    select: { timestamp: true },
    orderBy: { timestamp: "asc" },
    distinct: ["timestamp"],
  });

  const uniqueYears = new Set(years.map(t => t.timestamp.getFullYear()));
  const availableYears = [...uniqueYears]
    .filter(y => y <= currentYear)
    .sort((a, b) => a - b);

  return NextResponse.json({ years: availableYears });
}
