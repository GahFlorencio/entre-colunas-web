/** BigInt references stay textual throughout the operation lifecycle. */
export type PaymentInput = { value: number; description: string };
export type IncomeInput = PaymentInput & { expense_category_id: string };
export type AdjustmentInput = PaymentInput & {
  kind: "adjustment" | "opening_balance";
  direction: "debit" | "credit";
  justification: string;
  source_entry_id?: string;
};
export type ReversalInput = { description: string; justification: string };
export type OperationSummary = {
  id: string;
  type: string;
  financial_period_id: string;
  member_id: string | null;
  entry_ids: string[];
  value: number;
};
export type OperationEntry = {
  id: string;
  financial_account_id: string;
  financial_period_id: string;
  direction: "debit" | "credit";
  value: number;
  description: string;
  category_label: string | null;
  source_entry_id: string | null;
};
export type OperationDetail = Omit<OperationSummary, "value"> & {
  description: string;
  created_user_id: string;
  created_at: string;
  entries: OperationEntry[];
};
export type OperationPage = {
  results: OperationDetail[];
  total: number;
  page: number;
  per_page: number;
};
export type OperationFilters = {
  type?: string;
  member_id?: string;
  financial_period_id?: string;
};
