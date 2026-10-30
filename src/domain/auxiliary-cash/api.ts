import { ApiError } from "@/domain/auth/api";
import { requestLodgeFinancialResource } from "@/domain/lodge-financial/api";
import { isRecord, isId } from "@/domain/financial-operations/validation";
export type Cash = "agape" | "hospitalaria";
export type CashKind = "opening_balance" | "transfer" | "expense";
export const cashNames = { agape: "Ágape", hospitalaria: "Hospitalaria" };
export const kindNames = {
  opening_balance: "Saldo inicial",
  transfer: "Transferência da loja",
  expense: "Despesa",
};
export type CashInput = {
  kind: CashKind;
  description: string;
  value: number;
  occurred_on: string;
};
export type CashEntry = CashInput & {
  id: string;
  direction: "credit" | "debit";
  created_at: string;
  lodge_operation_id: string | null;
};
export type CashFilters = { from: string; to: string; kind: "" | "expense" };
export type CashPage = {
  cash: Cash;
  balance: number;
  revision: string;
  can_open: boolean;
  totals: { credits: number; expenses: number };
  results: CashEntry[];
  total: number;
  page: number;
  per_page: number;
  generated_at: string;
};
function invalid(): never {
  throw new ApiError(
    "A API retornou dados incompatíveis para este caixa.",
    undefined,
    "invalid-response",
  );
}
function amount(v: unknown): v is number {
  return (
    typeof v === "number" &&
    Number.isFinite(v) &&
    v >= 0 &&
    Number.isSafeInteger(Math.round(v * 100))
  );
}
function entry(v: unknown): CashEntry {
  if (
    !isRecord(v) ||
    !isId(v.id) ||
    !["opening_balance", "transfer", "expense"].includes(String(v.kind)) ||
    !amount(v.value) ||
    v.value <= 0 ||
    v.direction !== (v.kind === "expense" ? "debit" : "credit") ||
    typeof v.description !== "string" ||
    typeof v.occurred_on !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v.occurred_on) ||
    typeof v.created_at !== "string" ||
    !Number.isFinite(Date.parse(v.created_at)) ||
    !(v.lodge_operation_id === null || isId(v.lodge_operation_id))
  )
    invalid();
  return v as CashEntry;
}
export function cashPage(v: unknown, cash: Cash): CashPage {
  if (
    !isRecord(v) ||
    v.cash !== cash ||
    !amount(v.balance) ||
    typeof v.revision !== "string" ||
    !/^\d+$/.test(v.revision) ||
    typeof v.can_open !== "boolean" ||
    !isRecord(v.totals) ||
    !amount(v.totals.credits) ||
    !amount(v.totals.expenses) ||
    !Array.isArray(v.results) ||
    !Number.isSafeInteger(v.total) ||
    Number(v.total) < 0 ||
    !Number.isSafeInteger(v.page) ||
    Number(v.page) < 1 ||
    !Number.isSafeInteger(v.per_page) ||
    Number(v.per_page) < 0 ||
    typeof v.generated_at !== "string" ||
    !Number.isFinite(Date.parse(v.generated_at))
  )
    invalid();
  const results = v.results.map(entry);
  if (new Set(results.map((e) => e.id)).size !== results.length) invalid();
  return { ...v, results } as CashPage;
}
function path(lodgeId: string, cash: Cash) {
  if (!isId(lodgeId) || !(cash in cashNames)) invalid();
  return `/lodge/${lodgeId}/cash/${cash}`;
}
export async function getCash(
  token: string,
  lodgeId: string,
  cash: Cash,
  filters: CashFilters,
  page = 1,
  report = false,
) {
  const params = new URLSearchParams({ page: String(page), per_page: "20" });
  for (const [key, value] of Object.entries(filters))
    if (value) params.set(key, value);
  const result = cashPage(
    await requestLodgeFinancialResource(
      token,
      `${path(lodgeId, cash)}/${report ? "report" : "movements"}?${params}`,
    ),
    cash,
  );
  if (
    result.results.some(
      (e) =>
        (filters.kind && e.kind !== filters.kind) ||
        (filters.from && e.occurred_on < filters.from) ||
        (filters.to && e.occurred_on > filters.to),
    )
  )
    invalid();
  if (report) {
    if (result.results.length !== result.total) invalid();
    let credits = 0n,
      expenses = 0n;
    for (const movement of result.results) {
      const cents = BigInt(Math.round(movement.value * 100));
      if (movement.kind === "expense") expenses += cents;
      else credits += cents;
    }
    if (
      credits !== BigInt(Math.round(result.totals.credits * 100)) ||
      expenses !== BigInt(Math.round(result.totals.expenses * 100))
    )
      invalid();
  }
  if (!report && (result.page !== page || result.per_page !== 20)) invalid();
  return result;
}
