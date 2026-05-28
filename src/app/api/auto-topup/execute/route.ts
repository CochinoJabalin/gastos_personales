import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { executeTransfer } from "@/lib/transfer-utils";

export const dynamic = "force-dynamic";

/**
 * POST /api/auto-topup/execute
 * Manually execute the auto-topup transfer (without checking threshold).
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const config = await prisma.autoTopupConfig.findFirst();
    if (!config) {
      return NextResponse.json(
        { error: "Configuración de Auto-Topup no encontrada" },
        { status: 404 }
      );
    }

    if (!config.enabled) {
      return NextResponse.json(
        { error: "Auto-Topup está desactivado" },
        { status: 400 }
      );
    }

    // Find source account (default account of source bank)
    const sourceAccount = await prisma.account.findFirst({
      where: {
        bank: { bank_name: config.sourceBankName },
        is_default: true,
      },
      include: { bank: true },
    });

    // Find target account (default account of target bank)
    const targetAccount = await prisma.account.findFirst({
      where: {
        bank: { bank_name: config.targetBankName },
        is_default: true,
      },
      include: { bank: true },
    });

    if (!sourceAccount) {
      return NextResponse.json(
        { error: `Cuenta origen "${config.sourceBankName}" no encontrada` },
        { status: 404 }
      );
    }

    if (!targetAccount) {
      return NextResponse.json(
        { error: `Cuenta destino "${config.targetBankName}" no encontrada` },
        { status: 404 }
      );
    }

    const topupAmount = Number(config.amount);
    const sourceBalance = Number(sourceAccount.balance);
    const targetBalance = Number(targetAccount.balance);

    // Check if source has enough balance
    if (sourceBalance < topupAmount) {
      return NextResponse.json(
        {
          error: `Saldo insuficiente en ${sourceAccount.account_label}: ${sourceBalance.toFixed(2)}€ < ${topupAmount.toFixed(2)}€`,
        },
        { status: 400 }
      );
    }

    // Create and execute the transfer
    const transfer = await prisma.transfer.create({
      data: {
        from_account_id: sourceAccount.id,
        to_account_id: targetAccount.id,
        amount: topupAmount,
        concept: `Topup manual desde ${sourceAccount.bank.bank_name}`,
        timestamp: new Date(),
        status: "pending",
        is_scheduled: false,
        enabled: true,
      },
    });

    await executeTransfer(transfer.id);

    // Update lastCheck
    await prisma.autoTopupConfig.update({
      where: { id: "default" },
      data: { lastCheck: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: `Transferencia de ${topupAmount.toFixed(2)}€ ejecutada`,
      transfer: {
        id: transfer.id,
        from: `${sourceAccount.bank.bank_name} - ${sourceAccount.account_label}`,
        to: `${targetAccount.bank.bank_name} - ${targetAccount.account_label}`,
        amount: topupAmount,
        sourceBalanceBefore: sourceBalance,
        targetBalanceBefore: targetBalance,
      },
    });
  } catch (error) {
    console.error("[AutoTopup Execute] Error:", error);
    return NextResponse.json(
      { error: "Error al ejecutar el Auto-Topup" },
      { status: 500 }
    );
  }
}
