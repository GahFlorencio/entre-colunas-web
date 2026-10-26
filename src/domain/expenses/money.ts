/** Parse a pt-BR monetary input without passing through floating-point math. */
export function normalizeMoneyInput(input: string): string {
  // Decimal keyboards on Android may expose a dot even when the device locale is pt-BR.
  // Preserve formatted values that already use a decimal comma, such as "1.234,56".
  return input.includes(",") ? input : input.replace(".", ",");
}

export function parseMoneyToCents(input: string): number | null {
  const value = input.trim();
  if (!value) return null;
  const normalized = value.replace(/R\$\s*/i, "").replace(/\s/g, "");
  let wholeText: string;
  let fractionText = "";
  if (normalized.includes(",")) {
    if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(normalized))
      return null;
    [wholeText, fractionText] = normalized.split(",");
  } else if (/^\d+\.\d{1,2}$/.test(normalized)) {
    // Android decimal keyboards can emit a dot even when the app displays pt-BR examples.
    [wholeText, fractionText] = normalized.split(".");
  } else {
    if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)$/.test(normalized)) return null;
    wholeText = normalized;
  }
  const whole = Number(wholeText.replaceAll(".", ""));
  const cents = Number(fractionText.padEnd(2, "0"));
  const total = whole * 100 + cents;
  return Number.isSafeInteger(total) ? total : null;
}

export function centsToAmount(cents: number): number {
  if (!Number.isSafeInteger(cents))
    throw new RangeError("O valor em centavos precisa ser um inteiro seguro.");
  return cents / 100;
}

export function amountToCents(value: number): number {
  if (!Number.isFinite(value))
    throw new RangeError("O valor retornado pela API não é numérico.");
  const cents = Math.round((value + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(cents))
    throw new RangeError(
      "O valor retornado pela API excede a precisão segura.",
    );
  return cents;
}

export function formatBRL(value: number): string {
  return (amountToCents(value) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatBRLFromCents(cents: number): string {
  return formatBRL(centsToAmount(cents));
}
