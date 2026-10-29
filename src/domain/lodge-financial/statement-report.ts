import type { LodgeFinancialMovementPage } from "./types";

/** Collect the complete filtered statement; never substitute a page sum for the global balance. */
export async function collectStatementReport(
  fetchPage: (page: number) => Promise<LodgeFinancialMovementPage>,
  assertCurrent: () => void,
  onProgress: (done: number, total: number) => void,
) {
  let first: LodgeFinancialMovementPage | undefined;
  const movements: LodgeFinancialMovementPage["results"] = [];
  const ids = new Set<string>();
  for (let page = 1; ; page++) {
    assertCurrent();
    const result = await fetchPage(page);
    assertCurrent();
    first ??= result;
    if (
      result.page !== page ||
      result.per_page < 1 ||
      result.results.length > result.per_page ||
      result.total !== first.total ||
      result.balance !== first.balance ||
      result.per_page !== first.per_page ||
      JSON.stringify(result.totals) !== JSON.stringify(first.totals)
    )
      throw new Error(
        "O extrato mudou durante a exportação. Atualize e tente novamente.",
      );
    for (const movement of result.results) {
      if (ids.has(movement.id))
        throw new Error(
          "O extrato mudou durante a exportação. Atualize e tente novamente.",
        );
      ids.add(movement.id);
      movements.push(movement);
    }
    if (
      movements.length > first.total ||
      (!result.results.length && movements.length < first.total)
    )
      throw new Error(
        "Não foi possível obter o extrato completo. Tente novamente.",
      );
    onProgress(movements.length, first.total);
    if (movements.length === first.total)
      return { movements, balance: first.balance, total: first.total };
  }
}

export type StatementReport = Awaited<
  ReturnType<typeof collectStatementReport>
> & {
  lodgeName: string;
  generatedAt: string;
  from: string;
  to: string;
};
