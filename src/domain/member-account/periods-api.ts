import { ApiError } from "@/domain/auth/api";
import { requestMemberAccountResource } from "./api";
import type { MemberAccountMovement } from "./types";

export type MemberFinancialPeriod = {
  id: string;
  sequence: number;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
};

export type CursorReadPage<T> = { items: T[]; nextPage: number | null };
const PAGE_SIZE = 10;
const id = (value: unknown): value is string =>
  typeof value === "string" && /^[1-9]\d*$/.test(value);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const date = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const money = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Number.isSafeInteger(Math.round(value * 100));

function invalid(): never {
  throw new ApiError(
    "A API retornou dados de período incompatíveis. Atualize e tente novamente.",
    undefined,
    "invalid-response",
  );
}

function route(lodgeId: string, ...ids: string[]): string {
  if (![lodgeId, ...ids].every(id))
    throw new ApiError("Loja, membro ou período inválido.", 400, "validation");
  return `/lodge/${encodeURIComponent(lodgeId)}`;
}

function requirePage(page: number): void {
  if (!Number.isSafeInteger(page) || page < 1)
    throw new ApiError("Página inválida.", 400, "validation");
}

function pageEnvelope(
  value: unknown,
  requested: number,
): { results: unknown[]; nextPage: number | null } {
  if (
    !record(value) ||
    !Array.isArray(value.results) ||
    value.page !== requested ||
    value.per_page !== PAGE_SIZE ||
    !Number.isSafeInteger(value.total) ||
    Number(value.total) < 0
  )
    invalid();
  return {
    results: value.results,
    nextPage:
      value.results.length > 0 && requested * PAGE_SIZE < Number(value.total)
        ? requested + 1
        : null,
  };
}

function periodFrom(value: unknown, lodgeId: string): MemberFinancialPeriod {
  if (
    !record(value) ||
    !id(value.id) ||
    value.masonic_lodge_id !== lodgeId ||
    !Number.isSafeInteger(value.sequence) ||
    Number(value.sequence) < 1 ||
    (value.status !== "open" && value.status !== "closed") ||
    !date(value.opened_at) ||
    !(value.closed_at === null || date(value.closed_at))
  )
    invalid();
  return {
    id: value.id,
    sequence: Number(value.sequence),
    status: value.status,
    opened_at: value.opened_at,
    closed_at: value.closed_at,
  };
}

export async function listMemberFinancialPeriods(
  token: string,
  lodgeId: string,
  page: number,
  signal?: AbortSignal,
): Promise<CursorReadPage<MemberFinancialPeriod>> {
  requirePage(page);
  const base = route(lodgeId);
  const payload = await requestMemberAccountResource(
    token,
    `${base}/financial/periods?page=${page}&per_page=${PAGE_SIZE}`,
    signal,
  );
  const source = pageEnvelope(payload, page);
  return {
    items: source.results.map((value) => periodFrom(value, lodgeId)),
    nextPage: source.nextPage,
  };
}

/** Decimal ID comparison without coercion to Number (IDs can exceed MAX_SAFE_INTEGER). */
function descendingId(a: string, b: string): number {
  return b.length - a.length || (a === b ? 0 : a < b ? 1 : -1);
}

function operationDebits(
  value: unknown,
  accountId: string,
  periodId: string,
): MemberAccountMovement[] {
  if (
    !record(value) ||
    !id(value.id) ||
    value.financial_period_id !== periodId ||
    typeof value.type !== "string" ||
    !date(value.created_at) ||
    !Array.isArray(value.entries)
  )
    invalid();
  const operationId = value.id;
  const operationType = value.type;
  const createdAt = value.created_at;
  return value.entries
    .flatMap((entry): MemberAccountMovement[] => {
      if (
        !record(entry) ||
        !id(entry.id) ||
        !id(entry.financial_account_id) ||
        entry.financial_period_id !== periodId ||
        (entry.direction !== "debit" && entry.direction !== "credit") ||
        !money(entry.value) ||
        typeof entry.description !== "string" ||
        !(
          entry.category_label === null ||
          typeof entry.category_label === "string"
        )
      )
        invalid();
      if (
        entry.financial_account_id !== accountId ||
        entry.direction !== "debit"
      )
        return [];
      return [
        {
          id: entry.id,
          financial_operation_id: operationId,
          financial_period_id: periodId,
          direction: "debit",
          value: entry.value,
          description: entry.description,
          category_label: entry.category_label,
          operation_type: operationType,
          created_at: createdAt,
          timestamp_source: "operation",
        },
      ];
    })
    .sort((a, b) => descendingId(a.id, b.id));
}

export async function listMemberPeriodDebits(
  token: string,
  lodgeId: string,
  memberId: string,
  periodId: string,
  page: number,
  signal?: AbortSignal,
): Promise<CursorReadPage<MemberAccountMovement>> {
  requirePage(page);
  const base = route(lodgeId, memberId, periodId);
  const [account, period] = await Promise.all([
    requestMemberAccountResource(
      token,
      `${base}/member/${memberId}/financial/account`,
      signal,
    ),
    requestMemberAccountResource(
      token,
      `${base}/financial/periods/${periodId}`,
      signal,
    ),
  ]);
  const validatedPeriod = periodFrom(period, lodgeId);
  if (validatedPeriod.id !== periodId) invalid();
  if (
    !record(account) ||
    account.type !== "member" ||
    account.member_id !== memberId ||
    !(account.id === null || id(account.id)) ||
    !money(account.balance)
  )
    invalid();
  if (account.id === null) return { items: [], nextPage: null };
  const accountId = account.id;
  let sourcePage: number | null = page;
  // A period close has no member_id and can contain entries for every member.
  // Filter by the validated account, never by the operation's optional member.
  while (sourcePage !== null) {
    if (signal?.aborted) throw new Error("Consulta cancelada.");
    const payload = await requestMemberAccountResource(
      token,
      `${base}/financial/operations?financial_period_id=${periodId}&page=${sourcePage}&per_page=${PAGE_SIZE}`,
      signal,
    );
    const source = pageEnvelope(payload, sourcePage);
    const items = source.results.flatMap((operation) =>
      operationDebits(operation, accountId, periodId),
    );
    if (items.length > 0 || source.nextPage === null)
      return { items, nextPage: source.nextPage };
    sourcePage = source.nextPage;
  }
  return { items: [], nextPage: null };
}

export function totalLoadedDebits(
  items: MemberAccountMovement[],
): number | null {
  const cents = items.reduce(
    (sum, item) => sum + Math.round(Math.abs(item.value) * 100),
    0,
  );
  if (!Number.isSafeInteger(cents)) return null;
  return cents / 100;
}
