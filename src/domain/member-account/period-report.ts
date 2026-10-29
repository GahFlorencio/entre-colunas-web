import { requestMemberAccountResource } from "./api";

export type MemberPeriodCharge = {
  key: string;
  type: string;
  description: string;
  category_label: string | null;
  value: number;
  direction: "debit";
  financial_operation_id: string | null;
};
export type MemberPeriodReport = {
  masonic_lodge_id: string;
  financial_period_id: string;
  sequence: number;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  generated_at: string;
  member_id: string;
  member_name: string;
  member_status_slug: string;
  total_charges: number;
  items: MemberPeriodCharge[];
  impediments: string[];
};
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[1-9]\d*$/.test(value);
const validDate = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const validMoney = (value: unknown): value is number =>
  typeof value === "number" &&
  value >= 0 &&
  Number.isFinite(value) &&
  Number.isSafeInteger(Math.round(value * 100));
export async function getMemberPeriodReport(
  token: string,
  lodgeId: string,
  memberId: string,
  periodId: string,
): Promise<MemberPeriodReport> {
  if (![lodgeId, memberId, periodId].every(validId))
    throw new Error("Loja, membro ou período inválido.");
  const report = await requestMemberAccountResource(
    token,
    `/lodge/${lodgeId}/financial/periods/${periodId}/members/${memberId}/report`,
  );
  const invalid = () => {
    throw new Error(
      "O demonstrativo do membro está incompleto ou inconsistente. Tente novamente.",
    );
  };
  if (
    !record(report) ||
    report.masonic_lodge_id !== lodgeId ||
    report.member_id !== memberId ||
    report.financial_period_id !== periodId ||
    !Number.isSafeInteger(report.sequence) ||
    Number(report.sequence) < 1 ||
    !["open", "closed"].includes(String(report.status)) ||
    !validDate(report.opened_at) ||
    !(report.closed_at === null || validDate(report.closed_at)) ||
    (report.status === "closed" && report.closed_at === null) ||
    !validDate(report.generated_at) ||
    typeof report.member_name !== "string" ||
    typeof report.member_status_slug !== "string" ||
    !validMoney(report.total_charges) ||
    !Array.isArray(report.items) ||
    !Array.isArray(report.impediments) ||
    !report.impediments.every((item) => typeof item === "string")
  )
    return invalid();
  const keys = new Set<string>();
  let cents = 0;
  for (const item of report.items) {
    if (
      !record(item) ||
      typeof item.key !== "string" ||
      keys.has(item.key) ||
      !["rateio", "individual", "contribution", "agape", "acrescimo"].includes(
        String(item.type),
      ) ||
      typeof item.description !== "string" ||
      !(
        item.category_label === null || typeof item.category_label === "string"
      ) ||
      !validMoney(item.value) ||
      item.direction !== "debit" ||
      !(
        item.financial_operation_id === null ||
        validId(item.financial_operation_id)
      )
    )
      return invalid();
    keys.add(item.key);
    cents += Math.round(item.value * 100);
  }
  if (
    !Number.isSafeInteger(cents) ||
    cents !== Math.round(report.total_charges * 100)
  )
    return invalid();
  return report as MemberPeriodReport;
}
export const chargeTypeLabel = (type: string) =>
  ({
    contribution: "Contribuição",
    agape: "Ágape",
    rateio: "Rateio",
    individual: "Individual",
    acrescimo: "Acréscimo",
  })[type] ?? type;
