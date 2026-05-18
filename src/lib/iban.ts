const COUNTRY_LENGTHS: Record<string, number> = {
  ES: 24,
  DE: 22,
  FR: 27,
  IT: 27,
  PT: 25,
  GB: 22,
  BE: 16,
  NL: 18,
  AT: 20,
};

export function validateIBAN(iban: string): { valid: boolean; normalized?: string; error?: string } {
  const cleaned = iban.replace(/[\s-]/g, "").toUpperCase();

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned)) {
    return { valid: false, error: "El IBAN debe empezar por 2 letras seguidas de 2 dígitos de control y el número de cuenta." };
  }

  const countryCode = cleaned.slice(0, 2);
  const expectedLength = COUNTRY_LENGTHS[countryCode];
  if (expectedLength && cleaned.length !== expectedLength) {
    return { valid: false, error: `El IBAN para ${countryCode} debe tener exactamente ${expectedLength} caracteres (tiene ${cleaned.length}).` };
  }

  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);

  let numericString = "";
  for (const char of rearranged) {
    if (char >= "A" && char <= "Z") {
      numericString += (char.charCodeAt(0) - 55).toString();
    } else {
      numericString += char;
    }
  }

  let remainder = 0;
  for (const digit of numericString) {
    remainder = (remainder * 10 + parseInt(digit, 10)) % 97;
  }

  if (remainder !== 1) {
    return { valid: false, error: "El código de seguridad (dígitos de control) del IBAN no es válido." };
  }

  return { valid: true, normalized: cleaned };
}

export function formatIBAN(iban: string): string {
  const cleaned = iban.replace(/\s/g, "");
  return cleaned.replace(/(.{4})/g, "$1 ").trim();
}
