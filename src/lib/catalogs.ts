import {
  listExpenseCategories,
  listExpenseMembers,
} from "@/domain/expenses/api";
export async function collectPages<T extends { id: string }>(
  fetchPage: (
    page: number,
  ) => Promise<{ results: T[]; total: number; page: number; per_page: number }>,
) {
  const results: T[] = [],
    ids = new Set<string>();
  let page = 1;
  while (true) {
    const response = await fetchPage(page);
    if (
      response.page !== page ||
      response.per_page < 1 ||
      (response.results.length === 0 && results.length < response.total)
    )
      throw new Error(
        "O catálogo mudou durante a consulta. Atualize e tente novamente.",
      );
    for (const item of response.results) {
      if (ids.has(item.id))
        throw new Error(
          "O catálogo mudou durante a consulta. Atualize e tente novamente.",
        );
      ids.add(item.id);
      results.push(item);
    }
    if (page * response.per_page >= response.total)
      return {
        results,
        total: results.length,
        page: 1,
        per_page: results.length,
      };
    page++;
  }
}
export const allCategories = (token: string, lodgeId: string) =>
  collectPages((page) =>
    listExpenseCategories(token, lodgeId, "true", { page, perPage: 100 }),
  );
export const allEligibleMembers = (token: string, lodgeId: string) =>
  collectPages((page) =>
    listExpenseMembers(token, lodgeId, { page, perPage: 100 }),
  );
