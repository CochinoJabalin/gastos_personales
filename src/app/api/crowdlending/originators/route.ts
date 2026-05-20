import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const originators = await prisma.originator.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(originators);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { name } = await request.json();
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }

  const existing = await prisma.originator.findUnique({ where: { name: name.trim() } });
  if (existing) {
    return NextResponse.json({ error: "Ya existe un originador con ese nombre" }, { status: 409 });
  }

  const originator = await prisma.originator.create({
    data: { name: name.trim() },
  });
  return NextResponse.json(originator, { status: 201 });
}
