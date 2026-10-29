import { describe, it, expect, vi } from "vitest";
import { collectStatementReport } from "../../src/domain/lodge-financial/statement-report";
import type { LodgeFinancialMovementPage } from "../../src/domain/lodge-financial/types";
const movement = {
  id: "1",
  financial_operation_id: "2",
  financial_period_id: "3",
  direction: "credit" as const,
  value: 10,
  description: "Pagamento",
  category_label: null,
  operation_type: "member_payment",
  created_at: "2026-10-20T10:00:00Z",
};
const first: LodgeFinancialMovementPage = {
  results: [movement],
  total: 2,
  page: 1,
  per_page: 1,
  balance: 987,
  account_type: "lodge",
  member_id: null,
  totals: { total_credits: 20 },
};
const second = { ...first, page: 2, results: [{ ...movement, id: "2" }] };
describe("statement PDF collection", () => {
  it("starts at page one, preserves order and global balance", async () => {
    const fetchPage = vi.fn(async (page) => (page === 1 ? first : second));
    const report = await collectStatementReport(
      fetchPage,
      () => {},
      () => {},
    );
    expect(fetchPage.mock.calls).toEqual([[1], [2]]);
    expect(report.movements.map((m) => m.id)).toEqual(["1", "2"]);
    expect(report.balance).toBe(987);
  });
  for (const changed of [
    { total: 3 },
    { balance: 986 },
    { results: [movement] },
    { results: [] },
    { totals: { total_credits: 30 } },
  ]) {
    it(`rejects inconsistent pages: ${JSON.stringify(changed)}`, async () => {
      await expect(
        collectStatementReport(
          async (page) => (page === 1 ? first : { ...second, ...changed }),
          () => {},
          () => {},
        ),
      ).rejects.toThrow();
    });
  }
  it("rejects a failed page", async () => {
    await expect(
      collectStatementReport(
        async (page) => {
          if (page === 2) throw new Error("Falha");
          return first;
        },
        () => {},
        () => {},
      ),
    ).rejects.toThrow("Falha");
  });
  it("rejects stale results after a context change", async () => {
    let current = true;
    await expect(
      collectStatementReport(
        async () => {
          current = false;
          return first;
        },
        () => {
          if (!current) throw new Error("Mudou");
        },
        () => {},
      ),
    ).rejects.toThrow("Mudou");
  });
  it("accepts an empty statement without inventing a zero balance", async () => {
    const result = await collectStatementReport(
      async () => ({ ...first, total: 0, results: [] }),
      () => {},
      () => {},
    );
    expect(result.balance).toBe(987);
    expect(result.movements).toEqual([]);
  });
});
