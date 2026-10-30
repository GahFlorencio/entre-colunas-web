/** IDs returned by the API are BigInts serialized as strings. Keep them textual. */
import type { FinancialPeriodId } from "@/domain/financial-periods/types";

export type ExpenseId = string;
export type LodgeId = string;
export type MemberId = string;
export type CategoryId = string;
export type ExpenseTypeId = string;
export type {
  FinancialPeriod,
  FinancialPeriodDetail,
  FinancialPeriodMemberSnapshot,
  FinancialPeriodPage,
} from "@/domain/financial-periods/types";

export type LodgeFinancialSettings = {
  masonic_lodge_id: LodgeId;
  monthly_contribution_value: number;
  monthly_agape_value: number;
  updated_user_id: string | null;
  updated_at: string | null;
};

export type UpdateLodgeFinancialSettingsInput = {
  monthly_contribution_value: number;
  monthly_agape_value: number;
};

export type ExpenseTypeSlug = "rateio" | "individual" | "geral" | (string & {});
export type ExpenseStatus =
  "active" | "partially_cancelled" | "cancelled" | (string & {});
export type InstallmentStatus =
  "scheduled" | "posted" | "cancelled" | "superseded" | (string & {});

export type ExpenseType = {
  id: ExpenseTypeId;
  label: string;
  slug: ExpenseTypeSlug;
};
export type ExpenseCategory = {
  id: CategoryId;
  label: string;
  slug: string;
  active: boolean;
  scope: "global" | "lodge";
};

export type ExpenseInstallment = {
  id: string;
  number: number;
  target_period_sequence: number;
  financial_period_id: FinancialPeriodId | null;
  value: number;
  status: InstallmentStatus;
};

export type Expense = {
  id: ExpenseId;
  label: string;
  masonic_lodge_id: LodgeId;
  financial_period_id: FinancialPeriodId;
  total_value: number;
  parcels: number;
  expense_type_slug: ExpenseTypeSlug;
  expense_category_slug: string;
  expense_category_id: CategoryId;
  expense_type_id: ExpenseTypeId;
  ratio_to_all: boolean | null;
  owner_expense_member_id: MemberId | null;
  payed: boolean;
  status: ExpenseStatus;
  programming_version: number;
  updated_at: string;
  installments: ExpenseInstallment[];
};

export type ExpensePage = {
  results: Expense[];
  total: number;
  page: number;
  per_page: number;
};

export type CreateExpenseInput = {
  label: string;
  total_value: number;
  parcels?: number;
  expense_category_id: CategoryId;
  expense_type_id: ExpenseTypeId;
  ratio_to_all?: boolean;
  owner_expense_member_id?: MemberId;
  payed?: boolean;
};

export type CreateExpenseCategoryInput = {
  label: string;
};

export type UpdateExpenseInput = {
  expected_updated_at: string;
  label?: string;
  total_value?: number;
  parcels?: number;
  expense_category_id?: CategoryId;
  expense_type_id?: ExpenseTypeId;
  ratio_to_all?: boolean;
  owner_expense_member_id?: MemberId;
  justification: string;
};

export type UpdateExpensePayedInput = { payed: boolean };
export type CancelExpenseInput = {
  installment_numbers?: number[];
  description: string;
  justification: string;
};
export type ExpenseCancellation = {
  expense_id: ExpenseId;
  status: ExpenseStatus;
  cancelled_value: number;
  cancelled_installment_numbers: number[];
  operation_id: string;
};

export type MemberCandidate = {
  id: MemberId;
  name: string;
  phone: string | null;
  agape_participant: boolean;
  lodge_beggin: string;
  status: { id: string; label: string; slug: string };
};
export type MemberPage = {
  results: MemberCandidate[];
  total: number;
  page: number;
  per_page: number;
};

export type ExpenseFilters = {
  financial_period_id?: FinancialPeriodId;
  member_id?: MemberId;
  expense_category_id?: CategoryId;
  expense_type_id?: ExpenseTypeId;
  payed?: boolean;
  expense_status?: ExpenseStatus;
  from?: string;
  to?: string;
};

export type ExpenseEntry = {
  id: string;
  financial_account_id: string;
  financial_period_id: FinancialPeriodId;
  direction: "debit" | "credit";
  value: number;
  description: string;
  category_label: string | null;
  source_entry_id: string | null;
};
