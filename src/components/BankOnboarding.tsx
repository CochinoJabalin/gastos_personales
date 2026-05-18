"use client";

import { useState } from "react";
import { formatIBAN } from "@/lib/iban";

interface BankOnboardingProps {
  onComplete: () => void;
}

export default function BankOnboarding({ onComplete }: BankOnboardingProps) {
  const [bankName, setBankName] = useState("");
  const [accountLabel, setAccountLabel] = useState("");
  const [iban, setIban] = useState("");
  const [ibanError, setIbanError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function validateIBANInput(value: string): boolean {
    const cleaned = value.replace(/[\s-]/g, "").toUpperCase();
    if (!cleaned) {
      setIbanError("");
      return true;
    }
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned)) {
      setIbanError("El IBAN debe empezar por 2 letras seguidas de 2 dígitos de control y el número de cuenta.");
      return false;
    }
    const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
    let numericString = "";
    for (const char of rearranged) {
      numericString += char >= "A" && char <= "Z" ? (char.charCodeAt(0) - 55).toString() : char;
    }
    let remainder = 0;
    for (const digit of numericString) {
      remainder = (remainder * 10 + parseInt(digit, 10)) % 97;
    }
    if (remainder !== 1) {
      setIbanError("El código de seguridad (dígitos de control) del IBAN no es válido.");
      return false;
    }
    setIbanError("");
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (iban && !validateIBANInput(iban)) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank_name: bankName,
          account_label: accountLabel,
          iban,
        }),
      });
      if (res.ok) {
        onComplete();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Error ${res.status}`);
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-primary-container rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-on-primary-container">
              account_balance
            </span>
          </div>
          <h1 className="text-headline-md text-on-surface mb-2">
            Bienvenido a tu Gestor Patrimonial
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Para empezar, necesitas dar de alta al menos una cuenta bancaria.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface-container rounded-xl p-6 space-y-4 border border-surface-container-high"
        >
          <div>
            <label className="block text-label-caps text-on-surface-variant mb-1.5 uppercase tracking-wider">
              Nombre del Banco
            </label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              required
              className="w-full rounded-lg bg-surface-container-high border border-surface-container-highest px-3 py-2.5 text-body-md text-on-surface placeholder-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Ej: Santander, BBVA, CaixaBank..."
            />
          </div>

          <div>
            <label className="block text-label-caps text-on-surface-variant mb-1.5 uppercase tracking-wider">
              Etiqueta de la Cuenta
            </label>
            <input
              type="text"
              value={accountLabel}
              onChange={(e) => setAccountLabel(e.target.value)}
              required
              className="w-full rounded-lg bg-surface-container-high border border-surface-container-highest px-3 py-2.5 text-body-md text-on-surface placeholder-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Ej: Nómina, Ahorros, Visa..."
            />
          </div>

          <div>
            <label className="block text-label-caps text-on-surface-variant mb-1.5 uppercase tracking-wider">
              IBAN
            </label>
            <input
              type="text"
              value={iban}
              onChange={(e) => { setIban(e.target.value.toUpperCase()); setIbanError(""); }}
              onBlur={() => iban && validateIBANInput(iban)}
              className="w-full rounded-lg bg-surface-container-high border border-surface-container-highest px-3 py-2.5 text-body-md text-on-surface placeholder-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="ES00 0000 0000 0000 0000 0000 (opcional)"
            />
            {ibanError && <p className="text-body-sm text-error">{ibanError}</p>}
          </div>

          {error && (
            <p className="text-body-sm text-error bg-error-container/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-body-md font-medium text-primary-on hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Creando..." : "Dar de Alta"}
          </button>
        </form>
      </div>
    </div>
  );
}
