import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rules = await prisma.mappingRule.findMany({
    select: { default_group: true },
    distinct: ["default_group"],
    orderBy: { default_group: "asc" },
  });

  const categories = rules.map((r) => r.default_group);
  return NextResponse.json(categories);
}
