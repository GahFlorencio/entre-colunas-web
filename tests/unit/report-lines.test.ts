import { describe, expect, it } from "vitest";
import {
  periodReportLines,
  periodReportStatementTotal,
} from "@/domain/financial-periods/report-lines";
import { periodReport } from "../fixtures/period-report";
describe("period statement increment", () => {
  it("omits the increment when zero", () => {
    expect(periodReportLines(periodReport)).toHaveLength(3);
    expect(periodReportStatementTotal(periodReport)).toBe(147.5);
  });
  it.each(["open", "closed"] as const)(
    "includes the %s increment only for active members without changing card charges",
    (status) => {
      const report = { ...periodReport, status, acrescimo: 5 };
      expect(periodReportLines(report).at(-1)).toMatchObject({
        type: "acrescimo",
        expense_id: null,
        value: 15,
        total_value: 15,
        allocated_value: 5,
        divisor: 3,
      });
      expect(periodReportStatementTotal(report)).toBe(162.5);
      expect(report.groups).toEqual(periodReport.groups);
    },
  );
  it("keeps cent precision and handles no active recipients", () => {
    expect(
      periodReportStatementTotal({ ...periodReport, acrescimo: 0.1 }),
    ).toBe(147.8);
    const report = {
      ...periodReport,
      acrescimo: 5,
      groups: periodReport.groups.map((g) => ({ ...g, member_count: 0 })),
    };
    expect(periodReportLines(report).at(-1)).toMatchObject({
      value: 0,
      allocated_value: null,
      divisor: 0,
    });
  });
});
