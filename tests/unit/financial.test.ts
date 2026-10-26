import { describe, it, expect, vi, afterEach } from "vitest";
import { validateLodgeFinancialSummary } from "@/domain/lodge-financial/summary-state";
import { listMemberPeriodDebits } from "@/domain/member-account/periods-api";
import {
  buildCreateExpensePayload,
  getExpenseActions,
} from "@/domain/expenses/rules";
const summary = {
  masonic_lodge_id: "9007199254740993",
  cash_balance: -50,
  unpaid_expenses_total: 30,
  accounts_receivable_total: 70,
  calculated_at: "2026-10-26T12:00:00.000Z",
};
afterEach(() => vi.unstubAllGlobals());
describe("authoritative financial data", () => {
  it("accepts a negative cash value and textual large identifiers", () => {
    expect(validateLodgeFinancialSummary(summary, "9007199254740993")).toEqual(
      summary,
    );
  });
  it.each([
    {},
    { ...summary, cash_balance: null },
    { ...summary, unpaid_expenses_total: -1 },
    { ...summary, accounts_receivable_total: NaN },
    { ...summary, masonic_lodge_id: "12" },
  ])(
    "rejects invalid or cross-lodge summary rather than inventing totals",
    (value) => {
      expect(() =>
        validateLodgeFinancialSummary(value, "9007199254740993"),
      ).toThrow();
    },
  );
  it("keeps rateio inclusion separate from agape participation", () => {
    const result = buildCreateExpensePayload({
      label: " Energia ",
      totalValueCents: 12050,
      parcels: 2,
      categoryId: "2",
      typeId: "1",
      typeSlug: "rateio",
      ratioToAll: false,
    });
    expect(result).toMatchObject({
      label: "Energia",
      ratio_to_all: false,
      total_value: 120.5,
    });
    expect(result).not.toHaveProperty("owner_expense_member_id");
  });
  it("restricts structural corrections after an installment is posted", () => {
    expect(
      getExpenseActions(
        {
          status: "active",
          expense_type_slug: "rateio",
          installments: [
            {
              id: "1",
              number: 1,
              target_period_sequence: 1,
              financial_period_id: "81",
              value: 100,
              status: "posted",
            },
          ],
        },
        "open",
      ),
    ).toMatchObject({ editDescription: true, editStructure: false });
  });
  it("selects only the requested account debits from a collective close", async () => {
    const baseEntry = {
      financial_period_id: "81",
      direction: "debit",
      value: 30,
      description: "Contribuição",
      category_label: null,
    };
    const responses = [
      { id: "51", type: "member", member_id: "9007199254740993", balance: -30 },
      {
        id: "81",
        masonic_lodge_id: "12",
        sequence: 1,
        status: "closed",
        opened_at: "2026-10-01T00:00:00.000Z",
        closed_at: "2026-10-26T12:00:00.000Z",
      },
      {
        results: [
          {
            id: "701",
            financial_period_id: "81",
            type: "period_close",
            member_id: null,
            created_at: "2026-10-26T12:00:00.000Z",
            entries: [
              { ...baseEntry, id: "601", financial_account_id: "51" },
              { ...baseEntry, id: "602", financial_account_id: "52" },
              {
                ...baseEntry,
                id: "603",
                financial_account_id: "51",
                direction: "credit",
              },
            ],
          },
        ],
        total: 1,
        page: 1,
        per_page: 10,
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(responses.shift()), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    const result = await listMemberPeriodDebits(
      "session",
      "12",
      "9007199254740993",
      "81",
      1,
    );
    expect(result.items.map((item) => item.id)).toEqual(["601"]);
    expect(result.nextPage).toBeNull();
  });
});
