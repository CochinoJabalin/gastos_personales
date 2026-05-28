import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  const category = searchParams.get("category");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (category) {
    where.group = { contains: category, mode: "insensitive" };
  } else {
    // Exclude transfers from the groups list
    where.group = { not: "Transferencia" };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  if (year) {
    const y = parseInt(year);
    const start = new Date(y, month ? parseInt(month) - 1 : 0, 1);
    if (month) {
      const end = new Date(y, parseInt(month), 1);
      where.timestamp = { gte: start, lt: end };
    } else {
      const yearEnd = new Date(y + 1, 0, 1);
      where.timestamp = { gte: start, lt: yearEnd > tomorrow ? tomorrow : yearEnd };
    }
  } else {
    where.timestamp = { lt: tomorrow };
  }

  const results = await prisma.transaction.groupBy({
    by: ["group", "type"],
    where,
    _count: true,
    orderBy: { _count: { group: "desc" } },
  });

  return NextResponse.json(
    results.map((r) => ({ group: r.group, type: r.type, count: r._count }))
  );
}
