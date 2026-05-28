import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  fixMonthlyTransferDates,
  regenerateAllScheduledExecutions,
} from "@/lib/transfer-utils";

export const dynamic = "force-dynamic";

/**
 * POST /api/transfers/fix-monthly-dates
 * Fix all monthly transfers to have next_run on day 01 and regenerate scheduled executions.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // Fix monthly transfer dates
    const fixedCount = await fixMonthlyTransferDates();

    // Regenerate all scheduled executions for the next 3 months
    const scheduledCount = await regenerateAllScheduledExecutions(3);

    return NextResponse.json({
      success: true,
      message: `Corregidas ${fixedCount} transferencias mensuales. Generadas ${scheduledCount} ejecuciones programadas.`,
      fixed: fixedCount,
      scheduled: scheduledCount,
    });
  } catch (error) {
    console.error("[FixMonthlyDates] Error:", error);
    return NextResponse.json(
      { error: "Error al corregir las fechas de transferencias mensuales" },
      { status: 500 }
    );
  }
}
