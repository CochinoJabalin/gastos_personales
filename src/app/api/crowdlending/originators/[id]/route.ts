import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { name } = await request.json();
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }

  const existing = await prisma.originator.findUnique({ where: { name: name.trim() } });
  if (existing && existing.id !== params.id) {
    return NextResponse.json({ error: "Ya existe un originador con ese nombre" }, { status: 409 });
  }

  const originator = await prisma.originator.update({
    where: { id: params.id },
    data: { name: name.trim() },
  });
  return NextResponse.json(originator);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await prisma.originator.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
