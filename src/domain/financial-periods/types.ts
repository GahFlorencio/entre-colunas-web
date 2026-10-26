/** BigInt identifiers are serialized by the API as strings; keep them textual. */
export type FinancialPeriodId = string;
export type FinancialLodgeId = string;
export type FinancialMemberId = string;

export type FinancialPeriod = {
  id: FinancialPeriodId;
  masonic_lodge_id: FinancialLodgeId;
  sequence: number;
  status: "open" | "closed";
  opened_at: string;
  captured_members: number;
};

/** The periods list uses the period detail response schema, with an empty members array. */
export type FinancialPeriodDetail = FinancialPeriod & {
  closed_at: string | null;
  closing_contribution_value: number | null;
  closing_agape_value: number | null;
  acrescimo: number;
  statements_count: number;
  closing_differences: FinancialPeriodDifference[] | null;
  members: FinancialPeriodMemberSnapshot[];
};

export type FinancialPeriodPage = {
  results: FinancialPeriodDetail[];
  total: number;
  page: number;
  per_page: number;
};

export type FinancialPeriodMemberSnapshot = {
  member_id: FinancialMemberId;
  member_name: string;
  member_status_slug: string;
  agape_participant: boolean;
  captured_at: string;
};

export type FinancialPeriodPreviewItemType =
  | "rateio"
  | "individual"
  | "contribution"
  | "agape"
  | "acrescimo"
  | "adjustment"
  | "opening_balance"
  | "member_payment"
  | "reversal"
  | (string & {});

export type FinancialPeriodPreviewItem = {
  type: FinancialPeriodPreviewItemType;
  description: string;
  value: number;
  direction: "debit" | "credit";
  category_label?: string | null;
  divisor: number | null;
  source_entry_id?: string | null;
};

export type FinancialPeriodDifference = {
  expense_id: string;
  installment_number: number;
  divisor: number;
  value: number;
};

export type FinancialPeriodPreviewMember = {
  member_id: FinancialMemberId;
  member_name: string;
  member_status_slug: string;
  current_balance: number;
  projected_balance: number;
  new_charges: number;
  rounding_base_value: number;
  divisors: number;
  items: FinancialPeriodPreviewItem[];
};

export type FinancialPeriodPreview = {
  financial_period_id: FinancialPeriodId;
  sequence: number;
  acrescimo: number;
  results: FinancialPeriodPreviewMember[];
  differences: FinancialPeriodDifference[];
  impediments: string[];
};

/** acrescimo is optional in the OpenAPI request schema and defaults to zero. */
export type PreviewFinancialPeriodInput = { acrescimo?: number };

export type CloseFinancialPeriodResponse = {
  closed_period_id: FinancialPeriodId;
  closed_sequence: number;
  closed_at: string;
  next_period: FinancialPeriod;
  statements_created: number;
  member_charge_movements_created: number;
  differences: FinancialPeriodDifference[];
};
