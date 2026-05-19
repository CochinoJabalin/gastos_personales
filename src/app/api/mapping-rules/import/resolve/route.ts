import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const resolutions: { pattern: string; action: "keep_existing" | "use_incoming"; incoming: { default_group: string; default_type: string } }[] = body.resolutions;

  if (!Array.isArray(resolutions)) {
    return NextResponse.json({ error: "Se requiere un array 'resolutions'" }, { status: 400 });
  }

  let updated = 0;
  let kept = 0;

  for (const res of resolutions) {
    if (res.action === "use_incoming") {
      const existing = await prisma.mappingRule.findFirst({
        where: { pattern: res.pattern },
      });
      if (existing) {
        await prisma.mappingRule.update({
          where: { id: existing.id },
          data: {
            default_group: res.incoming.default_group,
            default_type: res.incoming.default_type,
          },
        });
        updated++;
      }
    } else {
      kept++;
    }
  }

  return NextResponse.json({ updated, kept });
}
