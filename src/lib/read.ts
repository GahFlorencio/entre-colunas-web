import { token } from "./session";
import { requestLodgeFinancialResource } from "@/domain/lodge-financial/api";
import { lodgePath } from "./financial-write";
export type StatementItem = {
  id: string;
  type: string;
  description: string;
  value: number;
  divisor: number | null;
  category_label: string | null;
};
export type PeriodStatement = {
  id: string;
  financial_period_id: string;
  member_id: string;
  member_name: string;
  member_status_slug: string;
  new_charges_value: number;
  net_value: number;
  rounding_base_value: number;
  items: StatementItem[];
};
export async function readStatements(
  periodId: string,
  page: number,
): Promise<{
  results: PeriodStatement[];
  total: number;
  page: number;
  per_page: number;
}> {
  return (await requestLodgeFinancialResource(
    token.value,
    lodgePath(
      `/financial/periods/${encodeURIComponent(periodId)}/statements?page=${page}&per_page=20`,
    ),
  )) as {
    results: PeriodStatement[];
    total: number;
    page: number;
    per_page: number;
  };
}
