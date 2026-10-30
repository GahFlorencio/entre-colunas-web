import { afterEach, describe, expect, it, vi } from "vitest";
import { cashPage, getCash, type CashPage } from "@/domain/auxiliary-cash/api";
vi.mock("@/domain/lodge-financial/api", () => ({
  requestLodgeFinancialResource: vi.fn(),
}));
import { requestLodgeFinancialResource } from "@/domain/lodge-financial/api";
const response = (): CashPage => ({
  cash: "agape",
  balance: 90,
  revision: "2",
  can_open: false,
  totals: { credits: 0, expenses: 10 },
  total: 1,
  page: 1,
  per_page: 1,
  generated_at: "2026-10-30T12:00:00Z",
  results: [
    {
      id: "1",
      kind: "expense",
      direction: "debit",
      description: "Teste",
      value: 10,
      occurred_on: "2026-10-30",
      created_at: "2026-10-30T12:00:00Z",
      lodge_operation_id: null,
    },
  ],
});
afterEach(() => vi.resetAllMocks());
describe("independent cash report integrity", () => {
  it("rejects wrong account and malformed financial values", () => {
    expect(() => cashPage(response(), "hospitalaria")).toThrow();
    expect(() => cashPage({ ...response(), balance: NaN }, "agape")).toThrow();
    expect(() =>
      cashPage(
        {
          ...response(),
          results: [{ ...response().results[0], direction: "credit" }],
        },
        "agape",
      ),
    ).toThrow();
  });
  it.each(["partial", "totals", "filter", "duplicate"])(
    "refuses %s report without downloading",
    async (failure) => {
      const result = response();
      if (failure === "partial") result.total = 2;
      if (failure === "totals") result.totals.expenses = 20;
      if (failure === "filter") result.results[0]!.occurred_on = "2026-09-30";
      if (failure === "duplicate") {
        result.results.push(result.results[0]!);
        result.total = 2;
      }
      vi.mocked(requestLodgeFinancialResource).mockResolvedValue(result);
      await expect(
        getCash(
          "token",
          "12",
          "agape",
          { from: "2026-10-01", to: "2026-10-31", kind: "expense" },
          1,
          true,
        ),
      ).rejects.toThrow();
    },
  );
  it("uses complete report endpoint with applied dates, separate from page", async () => {
    vi.mocked(requestLodgeFinancialResource).mockResolvedValue(response());
    await expect(
      getCash(
        "token",
        "12",
        "agape",
        { from: "2026-10-01", to: "2026-10-31", kind: "expense" },
        1,
        true,
      ),
    ).resolves.toMatchObject({ balance: 90, total: 1 });
    expect(requestLodgeFinancialResource).toHaveBeenCalledWith(
      "token",
      expect.stringContaining("/cash/agape/report?"),
    );
  });
});
