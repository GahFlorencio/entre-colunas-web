export type MemberAccountMovement = {
  id: string;
  financial_operation_id: string;
  financial_period_id: string;
  direction: "debit" | "credit";
  value: number;
  description: string;
  category_label: string | null;
  operation_type: string;
  created_at: string;
  /** Operation queries expose only the operation timestamp, not the entry timestamp. */
  timestamp_source?: "operation";
};

export type MemberAccountMovementPage = {
  results: MemberAccountMovement[];
  total: number;
  page: number;
  per_page: number;
  balance: number;
  account_type: "member";
  member_id: string;
  /** Present in the server contract; its scope is undocumented and it is not a display total. */
  totals: unknown;
};

export type MemberAccountMovementOptions = {
  page?: number;
  perPage?: number;
  from?: string;
  to?: string;
};
