"use client";

import { useState } from "react";

interface BankManagerProps {
  banks: { id: string; bank_name: string; account_label: string; iban?: string | null }[];
  onBankAdded: () => void;
}

export default function BankManager({ banks, onBankAdded }: BankManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountLabel, setAccountLabel] = useState("");
  const [iban, setIban] = useState("");
  const [ibanError, setIbanError] = useState("");
  const [loading, setLoading] = useState(false);

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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (iban && !validateIBANInput(iban)) return;
    setLoading(true);
    try {
      const res = await fetch("/api/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bank_name: bankName, account_label: accountLabel, iban }),
      });
      if (res.ok) {
        setBankName("");
        setAccountLabel("");
        setIban("");
        setIbanError("");
        setShowForm(false);
        onBankAdded();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-md">
        <span className="text-label-caps text-on-surface-variant uppercase">
          {banks.length} banco{banks.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-label-caps text-primary hover:underline"
        >
          + Añadir banco
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-md p-md bg-surface-container-high rounded-xl space-y-md">
          <input
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Nombre del banco"
            required
            className="w-full bg-surface-container-lowest rounded-lg px-md py-md text-body-md text-on-surface border border-outline-variant focus:border-primary focus:outline-none"
          />
          <input
            type="text"
            value={accountLabel}
            onChange={(e) => setAccountLabel(e.target.value)}
            placeholder="Etiqueta de la cuenta"
            required
            className="w-full bg-surface-container-lowest rounded-lg px-md py-md text-body-md text-on-surface border border-outline-variant focus:border-primary focus:outline-none"
          />
          <input
            type="text"
            value={iban}
            onChange={(e) => { setIban(e.target.value.toUpperCase()); setIbanError(""); }}
            onBlur={() => iban && validateIBANInput(iban)}
            placeholder="IBAN (opcional)"
            className="w-full bg-surface-container-lowest rounded-lg px-md py-md text-body-md text-on-surface border border-outline-variant focus:border-primary focus:outline-none"
          />
          {ibanError && <p className="text-body-sm text-error">{ibanError}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-on py-md rounded-lg text-label-caps hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Creando..." : "Guardar banco"}
          </button>
        </form>
      )}

      {banks.length > 0 && (
        <div className="space-y-sm">
          {banks.map((b) => (
            <div key={b.id} className="flex items-center justify-between p-sm bg-surface-container-high rounded-lg">
              <div>
                <p className="text-body-md font-semibold text-on-surface">{b.bank_name}</p>
                <p className="text-label-caps text-on-surface-variant">{b.account_label}</p>
                {b.iban && <p className="text-label-xs text-on-surface-variant/60 font-mono mt-sm">{b.iban}</p>}
              </div>
              <span className="material-symbols-outlined text-on-surface-variant">account_balance</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}