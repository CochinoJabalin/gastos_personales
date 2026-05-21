import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface BudgetCategoryConfig {
  necessities: string[];
  desires: string[];
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let config = await prisma.appConfig.findFirst();
  if (!config) {
    config = await prisma.appConfig.create({ data: {} });
  }

  let budgetConfig: BudgetCategoryConfig = { necessities: [], desires: [] };
  try {
    const parsed = JSON.parse(config.budgetCategoryConfig || "{}");
    budgetConfig = {
      necessities: parsed.necessities || [],
      desires: parsed.desires || [],
    };
  } catch {
    budgetConfig = { necessities: [], desires: [] };
  }

  return NextResponse.json(budgetConfig);
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { necessities, desires } = body;

  if (!Array.isArray(necessities) || !Array.isArray(desires)) {
    return NextResponse.json(
      { error: "necessities y desires deben ser arrays" },
      { status: 400 }
    );
  }

  const existing = await prisma.appConfig.findFirst();
  if (!existing) {
    await prisma.appConfig.create({ data: {} });
  }

  const budgetConfig: BudgetCategoryConfig = {
    necessities: necessities.filter((n): n is string => typeof n === "string"),
    desires: desires.filter((d): d is string => typeof d === "string"),
  };

  const config = await prisma.appConfig.update({
    where: { id: "default" },
    data: { budgetCategoryConfig: JSON.stringify(budgetConfig) },
  });

  const saved = JSON.parse(config.budgetCategoryConfig || "{}");
  return NextResponse.json({
    necessities: saved.necessities || [],
    desires: saved.desires || [],
  });
}
