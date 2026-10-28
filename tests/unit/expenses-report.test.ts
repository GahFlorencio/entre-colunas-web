import { describe, it, expect, vi } from "vitest";
import {
  readAllExpenses,
  summarizeExpenses,
} from "../../src/domain/expenses/report";
import { listExpenses } from "../../src/domain/expenses/api";
import type { Expense } from "../../src/domain/expenses/types";
vi.mock("../../src/domain/expenses/api", () => ({
  listExpenses: vi.fn(),
  listExpenseCategories: vi.fn(),
}));
const expense = (id: string, value = 0.1, status = "active") =>
  ({ id, masonic_lodge_id: "8", total_value: value, status }) as Expense;
describe("relatório de despesas", () => {
  it("soma em centavos e mantém cancelamentos separados como valores originais", () => {
    const result = summarizeExpenses([
      expense("1"),
      expense("2", 0.2),
      expense("3", 12, "cancelled"),
    ]);
    expect(result.originalTotal).toBe(12.3);
    expect(result.groups[0]?.originalTotal).toBe(0.3);
    expect(result.groups[2]?.originalTotal).toBe(12);
  });
  it("reúne todas as páginas com os mesmos filtros", async () => {
    const api = vi.mocked(listExpenses);
    api.mockReset();
    api
      .mockResolvedValueOnce({
        results: [expense("1")],
        total: 2,
        page: 1,
        per_page: 1,
      })
      .mockResolvedValueOnce({
        results: [expense("2")],
        total: 2,
        page: 2,
        per_page: 1,
      });
    expect(
      (await readAllExpenses("t", "8", { payed: false })).map((e) => e.id),
    ).toEqual(["1", "2"]);
    expect(api.mock.calls[1]?.[2]?.filters).toEqual({ payed: false });
  });
  it("recusa uma exportação com registros repetidos entre páginas", async () => {
    vi.mocked(listExpenses)
      .mockReset()
      .mockResolvedValueOnce({
        results: [expense("1")],
        total: 2,
        page: 1,
        per_page: 1,
      })
      .mockResolvedValueOnce({
        results: [expense("1")],
        total: 2,
        page: 2,
        per_page: 1,
      });
    await expect(readAllExpenses("t", "8", {})).rejects.toThrow("mudaram");
  });
  it("recusa dados de outra loja", async () => {
    vi.mocked(listExpenses)
      .mockReset()
      .mockResolvedValueOnce({
        results: [{ ...expense("1"), masonic_lodge_id: "9" }],
        total: 1,
        page: 1,
        per_page: 100,
      });
    await expect(readAllExpenses("t", "8", {})).rejects.toThrow("outra loja");
  });
});
