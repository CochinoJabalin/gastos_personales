import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseSpanishNumber, applySign } from "@/lib/format";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const separator = formData.get("separator") as string || ";";

  if (!file) {
    return NextResponse.json({ error: "Faltan parámetros: archivo" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder("latin1").decode(buffer);
  }
  const lines = text.split("\n").filter((line) => line.trim());

  if (lines.length < 2) {
    return NextResponse.json({ error: "El CSV está vacío o solo tiene la cabecera" }, { status: 400 });
  }

  const headers = lines[0].toLowerCase().split(separator).map((h) => h.trim());
  const dateIdx = headers.findIndex((h) => h.includes("fecha") || h.includes("date"));
  const bankIdx = headers.findIndex((h) => h.includes("banco"));
  const conceptIdx = headers.findIndex((h) => h.includes("concepto") || h.includes("concept") || h.includes("descrip"));
  const commentsIdx = headers.findIndex((h) => h.includes("comentario"));
  const amountIdx = headers.findIndex((h) => h.includes("importe") || h.includes("amount"));

  if (dateIdx === -1 || bankIdx === -1 || conceptIdx === -1 || amountIdx === -1) {
    return NextResponse.json({
      error: "El CSV debe tener columnas: fecha;banco;concepto;comentarios;importe",
    }, { status: 400 });
  }

  const parseRow = (line: string, i: number) => {
    const cols = line.split(separator).map((c) => c.trim().replace(/^["']|["']$/g, ""));
    if (cols.length <= Math.max(dateIdx, bankIdx, conceptIdx, amountIdx)) return null;

    const dateStr = cols[dateIdx];
    const bankName = cols[bankIdx];
    const concept = cols[conceptIdx];
    const comments = commentsIdx !== -1 ? cols[commentsIdx] || null : null;
    const amount = parseSpanishNumber(cols[amountIdx]);

    if (!bankName || !concept || isNaN(amount)) return null;

    const dateParts = dateStr.split(/[/\-]/);
    if (dateParts.length !== 3) return null;
    const [day, month, yearStr] = dateParts.map(p => parseInt(p, 10));
    if (!day || !month || !yearStr || day > 31 || month > 12) return null;
    const yearNum = yearStr < 100 ? 2000 + yearStr : yearStr;
    const date = new Date(yearNum, month - 1, day);
    if (isNaN(date.getTime())) return null;

    return { dateStr, bankName, concept, comments, amount, date };
  };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i], i);
    if (row) rows.push(row);
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No se encontraron filas válidas en el CSV" }, { status: 400 });
  }

  const uniqueBankNames = [...new Set(rows.map((r) => r.bankName))];

  const allBanks = await prisma.bank.findMany();
  const bankByName = new Map(allBanks.map((b) => [b.bank_name.toLowerCase(), b]));

  const pendingBankNames = uniqueBankNames.filter(
    (name) => !bankByName.has(name.toLowerCase())
  );

  if (pendingBankNames.length > 0) {
    return NextResponse.json({
      phase: "banks_pending",
      pending_banks: pendingBankNames,
      total_rows: rows.length,
    });
  }

  const mappingRules = await prisma.mappingRule.findMany();
  const errors: string[] = [];
  const results: { date: string; concept: string; amount: number; group: string; type: string }[] = [];
  let created = 0;

  for (const row of rows) {
    try {
      const bank = bankByName.get(row.bankName.toLowerCase())!;

      let group = "Ocio";
      let type = "Variable";

      for (const rule of mappingRules) {
        if (row.concept.toLowerCase().includes(rule.pattern.toLowerCase())) {
          group = rule.default_group;
          type = rule.default_type;
          break;
        }
      }

      let finalAmount = applySign(row.amount, group);

      await prisma.transaction.create({
        data: {
          concept: row.concept,
          amount: finalAmount,
          bank_id: bank.id,
          group,
          type,
          timestamp: row.date,
          comentarios: row.comments,
        },
      });

      created++;
      results.push({ date: row.dateStr, concept: row.concept, amount: finalAmount, group, type });
    } catch {
      errors.push(`Error al procesar: ${row.concept}`);
    }
  }

  return NextResponse.json({
    created,
    errors,
    results,
  });
}
