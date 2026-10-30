const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR");

export const money = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? currencyFormatter.format(value)
    : "Indisponível";
export const date = (value?: string | null) =>
  value && !Number.isNaN(Date.parse(value))
    ? dateFormatter.format(new Date(value))
    : "—";
/** Calendar dates (e.g. admission) are not instants; retain the recorded day. */
export function calendarDate(value?: string | null) {
  const day = value?.slice(0, 10);
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return "—";
  const parsed = new Date(`${day}T12:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== day
  )
    return "—";
  return `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
}
export const initials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((v) => v[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Não foi possível concluir. Tente novamente.";
export const labels: Record<string, string> = {
  open: "Aberto",
  closed: "Fechado",
  active: "Ativa",
  cancelled: "Cancelada",
  partially_cancelled: "Cancelada parcialmente",
  member_payment: "Pagamento de membro",
  cash_transfer: "Transferência entre caixas",
  lodge_income: "Entrada da loja",
  income: "Entrada",
  adjustment: "Ajuste",
  opening_balance: "Saldo inicial",
  reversal: "Estorno",
  expense: "Despesa",
  expense_registration: "Registro de despesa",
  expense_correction: "Correção de despesa",
  expense_cancellation: "Cancelamento de despesa",
  rateio: "Rateio",
  individual: "Individual",
  geral: "Geral",
  period_close: "Fechamento de período",
  credit: "Crédito",
  debit: "Débito",
  scheduled: "Programada",
  posted: "Lançada",
  superseded: "Substituída",
};
export const label = (v: string) => labels[v] || v;

export function phone(value?: string | null): string {
  const raw = value?.trim();
  if (!raw) return "Sem telefone";
  let digits = raw.replace(/\D/g, "");
  const international =
    digits.startsWith("55") && [12, 13].includes(digits.length);
  if (international) digits = digits.slice(2);
  if (![10, 11].includes(digits.length)) return raw;
  return `${international ? "+55 " : ""}(${digits.slice(0, 2)}) ${digits.slice(2, -4)}-${digits.slice(-4)}`;
}
