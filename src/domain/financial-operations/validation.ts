import { ApiError } from "@/domain/auth/api";
import type {
  OperationDetail,
  OperationEntry,
  OperationPage,
  OperationSummary,
} from "./types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function isId(value: unknown): value is string {
  return typeof value === "string" && /^[1-9]\d*$/.test(value);
}
function invalid(): never {
  throw new ApiError(
    "A API retornou uma operação incompatível. Atualize e tente novamente.",
    undefined,
    "invalid-response",
  );
}
function money(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    Number.isSafeInteger(Math.round(value * 100)) &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-7
  );
}
function baseFrom(value: unknown) {
  if (
    !isRecord(value) ||
    !isId(value.id) ||
    typeof value.type !== "string" ||
    !value.type.trim() ||
    !isId(value.financial_period_id) ||
    !(value.member_id === null || isId(value.member_id)) ||
    !Array.isArray(value.entry_ids) ||
    !value.entry_ids.every(isId)
  )
    invalid();
  return {
    id: value.id,
    type: value.type,
    financial_period_id: value.financial_period_id,
    member_id: value.member_id,
    entry_ids: value.entry_ids as string[],
  };
}
export function summaryFrom(value: unknown): OperationSummary {
  const base = baseFrom(value);
  if (!isRecord(value) || !money(value.value)) invalid();
  return { ...base, value: value.value };
}
function entryFrom(value: unknown): OperationEntry {
  if (
    !isRecord(value) ||
    !isId(value.id) ||
    !isId(value.financial_account_id) ||
    !isId(value.financial_period_id) ||
    !["debit", "credit"].includes(String(value.direction)) ||
    !money(value.value) ||
    typeof value.description !== "string" ||
    !(
      value.category_label === null || typeof value.category_label === "string"
    ) ||
    !(value.source_entry_id === null || isId(value.source_entry_id))
  )
    invalid();
  return {
    id: value.id,
    financial_account_id: value.financial_account_id,
    financial_period_id: value.financial_period_id,
    direction: value.direction as OperationEntry["direction"],
    value: value.value,
    description: value.description,
    category_label: value.category_label,
    source_entry_id: value.source_entry_id,
  };
}
export function detailFrom(value: unknown): OperationDetail {
  const base = baseFrom(value);
  if (
    !isRecord(value) ||
    typeof value.description !== "string" ||
    !isId(value.created_user_id) ||
    typeof value.created_at !== "string" ||
    Number.isNaN(Date.parse(value.created_at)) ||
    !Array.isArray(value.entries)
  )
    invalid();
  const entries = value.entries.map(entryFrom);
  if (
    new Set(base.entry_ids).size !== base.entry_ids.length ||
    new Set(entries.map((e) => e.id)).size !== entries.length ||
    entries.length !== base.entry_ids.length ||
    entries.some((e) => !base.entry_ids.includes(e.id))
  )
    invalid();
  return {
    ...base,
    description: value.description,
    created_user_id: value.created_user_id,
    created_at: value.created_at,
    entries,
  };
}
export function pageFrom(value: unknown): OperationPage {
  if (
    !isRecord(value) ||
    !Array.isArray(value.results) ||
    !Number.isSafeInteger(value.total) ||
    Number(value.total) < 0 ||
    !Number.isSafeInteger(value.page) ||
    Number(value.page) < 1 ||
    !Number.isSafeInteger(value.per_page) ||
    Number(value.per_page) < 1 ||
    Number(value.per_page) > 100
  )
    invalid();
  return {
    results: value.results.map(detailFrom),
    total: Number(value.total),
    page: Number(value.page),
    per_page: Number(value.per_page),
  };
}
