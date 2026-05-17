import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseSpanishNumber } from "@/lib/format";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const separator = (formData.get("separator") as string) || ";";

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

  const allBanks = await prisma.bank.findMany();
  const bankByName = new Map(allBanks.map((b) => [b.bank_name.toLowerCase(), b]));
  const mappingRules = await prisma.mappingRule.findMany();
  const uniqueBankNames = new Set<string>();

  type ParsedRow = {
    line: number; dateStr: string; date: string; bankName: string;
    concept: string; comments: string | null; amount: number;
    group: string; type: string; yearNum: number; monthIdx: number; day: number;
  };

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator).map((c) => c.trim().replace(/^["']|["']$/g, ""));
    if (cols.length <= Math.max(dateIdx, bankIdx, conceptIdx, amountIdx)) continue;

    const dateStr = cols[dateIdx];
    const bankName = cols[bankIdx];
    const concept = cols[conceptIdx];
    const comments = commentsIdx !== -1 ? cols[commentsIdx] || null : null;
    const amount = parseSpanishNumber(cols[amountIdx]);
    if (!bankName || !concept || isNaN(amount)) continue;

    const dateParts = dateStr.split(/[/\-]/);
    if (dateParts.length !== 3) continue;
    const [day, month, yearStr] = dateParts.map((p) => parseInt(p, 10));
    if (!day || !month || !yearStr || day > 31 || month > 12) continue;
    const yearNum = yearStr < 100 ? 2000 + yearStr : yearStr;
    const monthIdx = month - 1;
    const dateObj = new Date(yearNum, monthIdx, day);
    if (isNaN(dateObj.getTime())) continue;

    uniqueBankNames.add(bankName);

    let group = "Ocio";
    let type = "Variable";
    for (const rule of mappingRules) {
      if (concept.toLowerCase().includes(rule.pattern.toLowerCase())) {
        group = rule.default_group;
        type = rule.default_type;
        break;
      }
    }

    rows.push({
      line: i, dateStr, date: dateObj.toISOString().split("T")[0], bankName,
      concept, comments, amount, group, type, yearNum, monthIdx, day,
    });
  }

  // Batch duplicate detection: query all existing transactions that match any row
  const orConditions = rows.map((r) => ({
    concept: r.concept,
    timestamp: {
      gte: new Date(r.yearNum, r.monthIdx, r.day),
      lt: new Date(r.yearNum, r.monthIdx, r.day + 1),
    },
  }));

  const duplicates = orConditions.length > 0
    ? await prisma.transaction.findMany({ where: { OR: orConditions } })
    : [];

  const duplicateMap = new Map<string, typeof duplicates[0]>();
  for (const d of duplicates) {
    const key = `${d.concept}|${d.timestamp.toISOString().split("T")[0]}`;
    duplicateMap.set(key, d);
  }

  const resultRows = rows.map((r) => {
    const key = `${r.concept}|${r.date}`;
    const existing = duplicateMap.get(key);
    return {
      line: r.line, dateStr: r.dateStr, date: r.date, bankName: r.bankName,
      concept: r.concept, comments: r.comments, amount: r.amount,
      group: r.group, type: r.type,
      duplicate: existing
        ? { id: existing.id, concept: existing.concept, amount: existing.amount, date: existing.timestamp.toISOString().split("T")[0] }
        : null,
    };
  });

  const pendingBanks = [...uniqueBankNames].filter(
    (name) => !bankByName.has(name.toLowerCase())
  );

  return NextResponse.json({
    rows: resultRows,
    total_rows: rows.length,
    has_duplicates: resultRows.some((r) => r.duplicate),
    pending_banks: pendingBanks,
    banks_resolved: allBanks.map((b) => ({ id: b.id, bank_name: b.bank_name })),
  });
}
