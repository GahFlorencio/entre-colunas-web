export type LodgeFinancialMovement = {
  id: string;
  financial_operation_id: string;
  financial_period_id: string;
  direction: "debit" | "credit";
  value: number;
  description: string;
  category_label: string | null;
  operation_type: string;
  created_at: string;
};

export type LodgeFinancialMovementPage = {
  results: LodgeFinancialMovement[];
  total: number;
  page: number;
  per_page: number;
  /** Contábil e global; não representa o indicador de caixa da Home. */
  balance: number;
  account_type: "lodge";
  member_id: null;
  totals: unknown;
};

export type LodgeFinancialMovementOptions = {
  page?: number;
  perPage?: number;
  from?: string;
  to?: string;
};
