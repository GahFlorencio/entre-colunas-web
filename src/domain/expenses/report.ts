import { listExpenses, listExpenseCategories } from "./api";
import { amountToCents, centsToAmount } from "./money";
import type { Expense, ExpenseCategory, ExpenseFilters } from "./types";

export function expenseTypeLabel(slug: string) {
  return (
    (
      { rateio: "Rateio", individual: "Individual", geral: "Geral" } as Record<
        string,
        string
      >
    )[slug] || slug
  );
}
export function expenseStatusLabel(status: string) {
  return (
    (
      {
        active: "Ativa",
        partially_cancelled: "Cancelada parcialmente",
        cancelled: "Cancelada",
      } as Record<string, string>
    )[status] || status
  );
}
export function expensePaymentLabel(expense: Expense) {
  return expense.status === "cancelled"
    ? "Cancelada"
    : expense.payed
      ? "Paga"
      : "A pagar";
}

type Page<T> = { results: T[]; total: number; page: number; per_page: number };
type ReadOptions = {
  assertCurrent?: () => void;
  onProgress?: (done: number, total: number) => void;
};
async function collectPages<T extends { id: string }>(
  fetchPage: (page: number) => Promise<Page<T>>,
  options: ReadOptions = {},
) {
  const rows: T[] = [],
    ids = new Set<string>();
  let total: number | undefined;
  for (let page = 1; ; page++) {
    options.assertCurrent?.();
    const result = await fetchPage(page);
    options.assertCurrent?.();
    if (
      !Array.isArray(result?.results) ||
      !Number.isSafeInteger(result.total) ||
      result.total < 0 ||
      result.page !== page ||
      !Number.isSafeInteger(result.per_page) ||
      result.per_page < 1 ||
      result.results.length > result.per_page
    )
      throw new Error(
        "A API retornou uma página inválida. Atualize e tente novamente.",
      );
    if (total !== undefined && total !== result.total)
      throw new Error(
        "Os registros mudaram durante a exportação. Atualize e tente novamente.",
      );
    total = result.total;
    for (const row of result.results) {
      if (typeof row.id !== "string" || !row.id || ids.has(row.id))
        throw new Error(
          "Os registros mudaram durante a exportação. Atualize e tente novamente.",
        );
      ids.add(row.id);
      rows.push(row);
    }
    if (rows.length > total || (!result.results.length && rows.length < total))
      throw new Error(
        "Não foi possível obter todos os registros. Atualize e tente novamente.",
      );
    options.onProgress?.(rows.length, total);
    if (rows.length === total) return rows;
  }
}
export async function readAllExpenses(
  token: string,
  lodgeId: string,
  filters: ExpenseFilters,
  options: ReadOptions = {},
) {
  const rows = await collectPages(
    (page) => listExpenses(token, lodgeId, { page, perPage: 100, filters }),
    options,
  );
  if (rows.some((row) => row.masonic_lodge_id !== lodgeId))
    throw new Error(
      "A API retornou despesas de outra loja. Atualize e tente novamente.",
    );
  return rows;
}
export function readExpenseCategories(
  token: string,
  lodgeId: string,
): Promise<ExpenseCategory[]> {
  return collectPages((page) =>
    listExpenseCategories(token, lodgeId, "all", { page, perPage: 100 }),
  );
}
export function summarizeExpenses(expenses: Expense[]) {
  const groups = [
    { status: "active", label: "Ativas" },
    { status: "partially_cancelled", label: "Canceladas parcialmente" },
    { status: "cancelled", label: "Canceladas" },
  ].map((group) => ({ ...group, count: 0, cents: 0 }));
  let totalCents = 0;
  for (const expense of expenses) {
    const cents = amountToCents(expense.total_value);
    if (cents < 0)
      throw new Error("A API retornou um valor de despesa inválido.");
    totalCents += cents;
    if (!Number.isSafeInteger(totalCents))
      throw new Error("O total excede o limite monetário suportado.");
    const group = groups.find((item) => item.status === expense.status);
    if (!group)
      throw new Error("A API retornou uma situação de despesa desconhecida.");
    group.count++;
    group.cents += cents;
  }
  return {
    count: expenses.length,
    originalTotal: centsToAmount(totalCents),
    groups: groups.map(({ cents, ...group }) => ({
      ...group,
      originalTotal: centsToAmount(cents),
    })),
  };
}
export type ExpensesReport = {
  lodgeName: string;
  generatedAt: string;
  filters: string[];
  expenses: Expense[];
  categories: Record<string, string>;
};
