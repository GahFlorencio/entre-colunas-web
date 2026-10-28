import type { PeriodReport, PeriodReportExpense } from "./types";

export type PeriodReportLine = Omit<
  PeriodReportExpense,
  "type" | "expense_id" | "installment_number"
> & {
  key: string;
  expense_id: string | null;
  type: "rateio" | "individual" | "geral" | "acrescimo";
  installment_number: number | null;
};

/** Use the same report snapshot for the screen and PDF, without reapplying charges to the cards. */
export function periodReportLines(report: PeriodReport): PeriodReportLine[] {
  const lines: PeriodReportLine[] = report.expenses.map((e) => ({
    ...e,
    key: `${e.expense_id}:${e.installment_number}`,
  }));
  if (report.acrescimo > 0) {
    const count = report.groups
      .filter((g) => g.key !== "away")
      .reduce((sum, g) => sum + g.member_count, 0);
    const total = (Math.round(report.acrescimo * 100) * count) / 100;
    lines.push({
      key: "acrescimo",
      expense_id: null,
      description: "Acréscimo por membro ativo",
      category: "Acréscimo do período",
      type: "acrescimo",
      installment_number: null,
      installments_count: 1,
      total_value: total,
      value: total,
      allocated_value: count ? report.acrescimo : null,
      divisor: count,
      allocation: "Somente ativos",
    });
  }
  return lines;
}

export function periodReportStatementTotal(report: PeriodReport): number {
  return (
    periodReportLines(report).reduce(
      (sum, line) => sum + Math.round(line.value * 100),
      0,
    ) / 100
  );
}
