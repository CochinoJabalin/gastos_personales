import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const separator = (formData.get("separator") as string) || ";";

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

    if (lines.length < 2) {
      return NextResponse.json({ error: "El CSV está vacío o solo tiene la cabecera" }, { status: 400 });
    }

    const clean = (s: string) => s.trim().replace(/^"(.*)"$/, "");
    const header = lines[0].split(separator).map(clean).map((s) => s.toLowerCase());
    const conceptIdx = header.findIndex((h) => h.includes("concept"));

    let catIdx = header.findIndex((h) => /^grupo|^group/.test(h));
    if (catIdx === -1) catIdx = header.findIndex((h) => h.includes("categ") && !h.includes("tipo"));
    if (catIdx === -1) catIdx = header.findIndex((h) => h.includes("categ"));

    let typeIdx = -1;
    for (let i = 0; i < header.length; i++) {
      if (i === catIdx) continue;
      if (header[i].includes("tipo")) { typeIdx = i; break; }
    }
    if (typeIdx === -1) typeIdx = header.findIndex((h) => h.includes("tipo"));

    if (conceptIdx === -1 || typeIdx === -1 || catIdx === -1 || typeIdx === catIdx) {
      return NextResponse.json({
        error: "La cabecera del CSV no tiene las columnas esperadas. Se encontró: " + header.join(", "),
      }, { status: 400 });
    }

    const errors: string[] = [];
    const results: { pattern: string; type: string; group: string; status: string }[] = [];
    const conflicts: { pattern: string; existing: { default_group: string; default_type: string }; incoming: { default_group: string; default_type: string } }[] = [];
    let created = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(separator).map(clean);
      if (parts.length <= Math.max(conceptIdx, typeIdx, catIdx)) {
        errors.push("Línea " + (i + 1) + ": faltan columnas");
        continue;
      }

      const concepto = parts[conceptIdx];
      const tipo = parts[typeIdx];
      const categoria = parts[catIdx];

      if (!concepto || !tipo || !categoria) {
        errors.push("Línea " + (i + 1) + ": campos vacíos");
        continue;
      }

      try {
        const existing = await prisma.mappingRule.findFirst({
          where: { pattern: concepto },
        });

        if (existing) {
          const sameGroup = existing.default_group === categoria;
          const sameType = existing.default_type === tipo;

          if (sameGroup && sameType) {
            skipped++;
            results.push({ pattern: concepto, type: tipo, group: categoria, status: "omitido" });
          } else {
            conflicts.push({
              pattern: concepto,
              existing: { default_group: existing.default_group, default_type: existing.default_type },
              incoming: { default_group: categoria, default_type: tipo },
            });
            results.push({ pattern: concepto, type: tipo, group: categoria, status: "conflicto" });
          }
        } else {
          await prisma.mappingRule.create({
            data: {
              pattern: concepto,
              default_group: categoria,
              default_type: tipo,
            },
          });
          created++;
          results.push({ pattern: concepto, type: tipo, group: categoria, status: "ok" });
        }
      } catch (err) {
        errors.push("Línea " + (i + 1) + ": " + (err as Error).message);
      }
    }

    return NextResponse.json({ created, skipped, conflicts, errors, results });
  } catch (err) {
    return NextResponse.json({ error: "Error al procesar el archivo: " + (err as Error).message }, { status: 500 });
  }
}