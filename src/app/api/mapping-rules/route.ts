import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

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

  const existing = await prisma.mappingRule.findFirst({
    where: { pattern: body.pattern },
  });

  if (existing) {
    const sameGroup = existing.default_group === body.default_group;
    const sameType = existing.default_type === body.default_type;

    if (sameGroup && sameType) {
      return NextResponse.json({ status: "ignorado", rule: existing });
    }

    return NextResponse.json({
      status: "conflicto",
      existing: {
        id: existing.id,
        pattern: existing.pattern,
        default_group: existing.default_group,
        default_type: existing.default_type,
        default_bank_id: existing.default_bank_id,
      },
      incoming: {
        pattern: body.pattern,
        default_group: body.default_group,
        default_type: body.default_type,
        default_bank_id: body.default_bank_id,
      },
    }, { status: 409 });
  }

  const rule = await prisma.mappingRule.create({
    data: {
      pattern: body.pattern,
      default_bank_id: body.default_bank_id,
      default_group: body.default_group,
      default_type: body.default_type,
    },
    include: { default_bank: true },
  });

  return NextResponse.json({ status: "creado", rule }, { status: 201 });
}
