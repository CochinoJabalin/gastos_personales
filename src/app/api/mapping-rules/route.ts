import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rules = await prisma.mappingRule.findMany({
    include: { default_bank: true },
    orderBy: { pattern: "asc" },
  });

  return NextResponse.json(rules);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();

  const rule = await prisma.mappingRule.create({
    data: {
      pattern: body.pattern,
      default_bank_id: body.default_bank_id,
      default_group: body.default_group,
      default_type: body.default_type,
    },
    include: { default_bank: true },
  });

  return NextResponse.json(rule, { status: 201 });
}
