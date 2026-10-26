import { centsToAmount } from "./money";
import type {
  CreateExpenseInput,
  Expense,
  ExpenseInstallment,
  ExpenseTypeSlug,
  MemberCandidate,
  FinancialPeriodMemberSnapshot,
  UpdateExpenseInput,
} from "./types";

export const MAX_DESCRIPTION_LENGTH = 255;
export const MAX_PARCELS = 2_147_483_647;

export type FieldErrors = Record<string, string>;
export type ExpenseDraft = {
  label: string;
  totalValueCents: number;
  parcels: number;
  categoryId: string;
  typeId: string;
  typeSlug: ExpenseTypeSlug;
  ratioToAll?: boolean;
  ownerMemberId?: string;
  payed?: boolean;
};

export function validateCommonExpenseFields(
  label: string,
  totalValueCents: number,
  parcels: number,
): FieldErrors {
  const errors: FieldErrors = {};
  const normalizedLabel = label.trim();
  if (!normalizedLabel) errors.label = "Informe uma descrição.";
  else if (normalizedLabel.length > MAX_DESCRIPTION_LENGTH)
    errors.label = "Use até 255 caracteres.";
  if (!Number.isSafeInteger(totalValueCents) || totalValueCents < 1)
    errors.totalValueCents = "Informe um valor de pelo menos R$ 0,01.";
  if (!Number.isInteger(parcels) || parcels < 1 || parcels > MAX_PARCELS)
    errors.parcels = "Informe um número inteiro entre 1 e 2147483647.";
  return errors;
}

function commonPayloadErrors(draft: ExpenseDraft): FieldErrors {
  const errors = validateCommonExpenseFields(
    draft.label,
    draft.totalValueCents,
    draft.parcels,
  );
  if (!draft.categoryId.trim()) errors.categoryId = "Selecione uma categoria.";
  if (!draft.typeId.trim()) errors.typeId = "Selecione um tipo de despesa.";
  if (draft.typeSlug === "rateio" && typeof draft.ratioToAll !== "boolean")
    errors.ratioToAll = "Informe como o rateio será distribuído.";
  if (draft.typeSlug === "individual" && !draft.ownerMemberId?.trim())
    errors.ownerMemberId = "Selecione o responsável.";
  return errors;
}

export function buildCreateExpensePayload(
  draft: ExpenseDraft,
): CreateExpenseInput {
  const errors = commonPayloadErrors(draft);
  if (Object.keys(errors).length) throw new ExpenseRuleError(errors);
  const payload: CreateExpenseInput = {
    label: draft.label.trim(),
    total_value: centsToAmount(draft.totalValueCents),
    parcels: draft.typeSlug === "geral" ? 1 : draft.parcels,
    expense_category_id: draft.categoryId,
    expense_type_id: draft.typeId,
    ...(draft.payed === undefined ? {} : { payed: draft.payed }),
  };
  if (draft.typeSlug === "rateio") payload.ratio_to_all = draft.ratioToAll!;
  if (draft.typeSlug === "individual")
    payload.owner_expense_member_id = draft.ownerMemberId!.trim();
  return payload;
}

export class ExpenseRuleError extends Error {
  constructor(readonly fields: FieldErrors) {
    super("Revise os campos destacados.");
    this.name = "ExpenseRuleError";
  }
}

type ComparableExpense = Pick<
  Expense,
  | "label"
  | "total_value"
  | "parcels"
  | "expense_category_id"
  | "expense_type_id"
  | "expense_type_slug"
  | "ratio_to_all"
  | "owner_expense_member_id"
>;

export function buildExpenseCorrection(
  current: ComparableExpense,
  draft: ExpenseDraft,
  justification: string,
): UpdateExpenseInput {
  const errors = commonPayloadErrors(draft);
  if (!justification.trim())
    errors.justification = "Informe o motivo da correção.";
  if (Object.keys(errors).length) throw new ExpenseRuleError(errors);
  const label = draft.label.trim();
  const changedType =
    current.expense_type_id !== draft.typeId ||
    current.expense_type_slug !== draft.typeSlug;
  const patch: UpdateExpenseInput = { justification: justification.trim() };
  if (current.label !== label) patch.label = label;
  if (Math.round(current.total_value * 100) !== draft.totalValueCents)
    patch.total_value = centsToAmount(draft.totalValueCents);
  const nextParcels = draft.typeSlug === "geral" ? 1 : draft.parcels;
  if (current.parcels !== nextParcels) patch.parcels = nextParcels;
  if (current.expense_category_id !== draft.categoryId)
    patch.expense_category_id = draft.categoryId;
  if (changedType) patch.expense_type_id = draft.typeId;
  if (
    draft.typeSlug === "rateio" &&
    (changedType || current.ratio_to_all !== draft.ratioToAll)
  )
    patch.ratio_to_all = draft.ratioToAll!;
  if (
    draft.typeSlug === "individual" &&
    (changedType || current.owner_expense_member_id !== draft.ownerMemberId)
  )
    patch.owner_expense_member_id = draft.ownerMemberId!.trim();
  if (Object.keys(patch).length === 1)
    throw new ExpenseRuleError({
      form: "Altere pelo menos um campo além da justificativa.",
    });
  return patch;
}

const eligibleStatus = (slug: string) =>
  slug === "ativo" || slug === "afastado";

export function eligibleIndividualMembers(
  currentMembers: MemberCandidate[],
  capturedMembers?: FinancialPeriodMemberSnapshot[] | null,
): MemberCandidate[] {
  const current = currentMembers.filter((member) =>
    eligibleStatus(member.status.slug),
  );
  if (capturedMembers == null) return current; // no period exists yet during initial registration
  const eligible = new Set(
    capturedMembers
      .filter((member) => eligibleStatus(member.member_status_slug))
      .map((member) => member.member_id),
  );
  return current.filter((member) => eligible.has(member.id));
}

export type ExpenseActions = {
  editDescription: boolean;
  editStructure: boolean;
  cancelScheduled: boolean;
  cancelGeneral: boolean;
};

export function getExpenseActions(
  expense: Pick<Expense, "status" | "expense_type_slug" | "installments">,
  originalPeriodStatus?: "open" | "closed" | null,
): ExpenseActions {
  const active = expense.status === "active";
  const cancellableState = active || expense.status === "partially_cancelled";
  const noPostedOrCancelled = !expense.installments.some(
    (item) => item.status === "posted" || item.status === "cancelled",
  );
  const hasScheduled = expense.installments.some(
    (item) => item.status === "scheduled",
  );
  const periodOpenOrNotRelevant =
    expense.expense_type_slug !== "geral" || originalPeriodStatus === "open";
  const structural = active && noPostedOrCancelled && periodOpenOrNotRelevant;
  return {
    editDescription: active,
    editStructure: structural,
    cancelScheduled:
      expense.expense_type_slug !== "geral" && cancellableState && hasScheduled,
    cancelGeneral:
      expense.expense_type_slug === "geral" &&
      active &&
      originalPeriodStatus === "open",
  };
}

export function scheduledInstallmentNumbers(
  installments: ExpenseInstallment[],
): number[] {
  return [
    ...new Set(
      installments
        .filter((item) => item.status === "scheduled")
        .map((item) => item.number),
    ),
  ].sort((a, b) => a - b);
}

export function partitionInstallments(installments: ExpenseInstallment[]) {
  return {
    current: installments.filter((item) => item.status !== "superseded"),
    previous: installments.filter((item) => item.status === "superseded"),
  };
}
