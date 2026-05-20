import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { oldGroup, newGroup, newType } = await request.json();
  if (!oldGroup || !newGroup) {
    return NextResponse.json(
      { error: "oldGroup y newGroup son requeridos" },
      { status: 400 }
    );
  }

  const where = { group: oldGroup };
  const data: Record<string, string> = { group: newGroup };
  if (newType) data.type = newType;

  const result = await prisma.transaction.updateMany({ where, data });
  return NextResponse.json({ updated: result.count });
}
