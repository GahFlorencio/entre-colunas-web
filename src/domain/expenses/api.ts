import { apiUrl } from "../../lib/runtime-config";
import { ApiError, getMe } from "@/domain/auth/api";
import { invalidateSession } from "@/domain/auth/session-events";
import type {
  CancelExpenseInput,
  Expense,
  ExpenseCancellation,
  ExpenseCategory,
  CreateExpenseCategoryInput,
  ExpenseFilters,
  ExpensePage,
  ExpenseType,
  FinancialPeriodDetail,
  FinancialPeriodPage,
  LodgeFinancialSettings,
  UpdateLodgeFinancialSettingsInput,
  MemberPage,
  CreateExpenseInput,
  UpdateExpenseInput,
} from "./types";

type PageOptions = { page: number; perPage: number };

function apiBaseUrl(): string {
  const value = apiUrl?.trim();
  if (!value)
    throw new ApiError(
      "A API não está configurada. Defina VITE_API_URL e reinicie o aplicativo.",
      undefined,
      "configuration",
    );
  return value.replace(/\/+$/, "");
}

function requireIds(...ids: string[]) {
  if (ids.some((id) => !id.trim()))
    throw new ApiError(
      "Selecione uma loja e um registro para continuar.",
      undefined,
      "configuration",
    );
}

function buildQuery(values: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined) query.set(key, value);
  return query.toString();
}

async function request<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!token.trim())
    throw new ApiError(
      "Sua sessão expirou. Entre novamente.",
      undefined,
      "unauthorized",
    );
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      cache: "no-store",
      signal: init?.signal ?? AbortSignal.timeout(20000),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Não foi possível conectar à API. Verifique sua conexão e tente novamente.",
      undefined,
      "network",
    );
  }
  if (response.status === 401) {
    invalidateSession(token);
    throw new ApiError(
      "Sua sessão expirou. Entre novamente.",
      401,
      "unauthorized",
    );
  }
  if (response.status === 503) {
    // The API uses 503 both for invalid sessions and for missing lodge access.
    await getMe(token).catch(() => undefined);
    throw new ApiError(
      "Você não tem autorização para acessar esta loja.",
      503,
      "unauthorized",
    );
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const body = payload as {
      message?: string | string[];
      error?: string;
    } | null;
    const message =
      (Array.isArray(body?.message)
        ? body.message.join(". ")
        : body?.message) ?? body?.error;
    if (response.status === 400)
      throw new ApiError(
        message ?? "Confira os dados informados e tente novamente.",
        400,
        "validation",
        Array.isArray(body?.message) ? body.message : undefined,
      );
    if (response.status === 404)
      throw new ApiError(
        message ??
          "Este registro não foi encontrado. Atualize os dados e tente novamente.",
        404,
        "not-found",
      );
    if (response.status === 409)
      throw new ApiError(
        message ??
          "Os dados foram alterados por outra ação. Atualize e revise antes de tentar novamente.",
        409,
        "conflict",
      );
    throw new ApiError(
      message ??
        "O serviço está temporariamente indisponível. Tente novamente.",
      response.status,
      "server",
    );
  }
  if (payload === null)
    throw new ApiError(
      "A API retornou uma resposta inválida. Atualize os dados antes de continuar.",
      response.status,
      "invalid-response",
    );
  return payload as T;
}

function lodgePath(lodgeId: string, suffix: string) {
  requireIds(lodgeId);
  return `/lodge/${encodeURIComponent(lodgeId)}${suffix}`;
}

export function getLodgeFinancialSettings(
  token: string,
  lodgeId: string,
): Promise<LodgeFinancialSettings> {
  return request(token, lodgePath(lodgeId, "/financial/settings"));
}

export function updateLodgeFinancialSettings(
  token: string,
  lodgeId: string,
  input: UpdateLodgeFinancialSettingsInput,
): Promise<LodgeFinancialSettings> {
  return request(token, lodgePath(lodgeId, "/financial/settings"), {
    method: "PUT",
    body: JSON.stringify({
      monthly_contribution_value: input.monthly_contribution_value,
      monthly_agape_value: input.monthly_agape_value,
    }),
  });
}

export function listExpenses(
  token: string,
  lodgeId: string,
  options: PageOptions & { filters?: ExpenseFilters },
): Promise<ExpensePage> {
  const query = buildQuery({
    page: String(options.page),
    per_page: String(options.perPage),
    financial_period_id: options.filters?.financial_period_id,
    member_id: options.filters?.member_id,
    expense_category_id: options.filters?.expense_category_id,
    expense_type_id: options.filters?.expense_type_id,
    payed:
      options.filters?.payed === undefined
        ? undefined
        : String(options.filters.payed),
    expense_status: options.filters?.expense_status,
    from: options.filters?.from,
    to: options.filters?.to,
  });
  return request(token, `${lodgePath(lodgeId, "/expense")}?${query}`);
}

export function getExpense(
  token: string,
  lodgeId: string,
  expenseId: string,
): Promise<Expense> {
  requireIds(expenseId);
  return request(
    token,
    lodgePath(lodgeId, `/expense/${encodeURIComponent(expenseId)}`),
  );
}

export function createExpense(
  token: string,
  lodgeId: string,
  input: CreateExpenseInput,
  idempotencyKey: string,
): Promise<Expense> {
  return request(token, lodgePath(lodgeId, "/expense"), {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  });
}

export function updateExpense(
  token: string,
  lodgeId: string,
  expenseId: string,
  input: UpdateExpenseInput,
  idempotencyKey: string,
): Promise<Expense> {
  requireIds(expenseId);
  return request(
    token,
    lodgePath(lodgeId, `/expense/${encodeURIComponent(expenseId)}`),
    {
      method: "PATCH",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    },
  );
}

export function updateExpensePayed(
  token: string,
  lodgeId: string,
  expenseId: string,
  payed: boolean,
): Promise<Pick<Expense, "id" | "payed">> {
  requireIds(expenseId);
  return request(
    token,
    lodgePath(lodgeId, `/expense/${encodeURIComponent(expenseId)}/payed`),
    { method: "PATCH", body: JSON.stringify({ payed }) },
  );
}

export function cancelExpense(
  token: string,
  lodgeId: string,
  expenseId: string,
  input: CancelExpenseInput,
  idempotencyKey: string,
): Promise<ExpenseCancellation> {
  requireIds(expenseId);
  return request(
    token,
    lodgePath(
      lodgeId,
      `/expense/${encodeURIComponent(expenseId)}/cancellation`,
    ),
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    },
  );
}

export function listExpenseTypes(
  token: string,
  lodgeId: string,
): Promise<ExpenseType[]> {
  return request(token, lodgePath(lodgeId, "/expense/type"));
}

export function listExpenseCategories(
  token: string,
  lodgeId: string,
  active: "all" | "true" = "all",
  options: PageOptions = { page: 1, perPage: 100 },
): Promise<{
  results: ExpenseCategory[];
  total: number;
  page: number;
  per_page: number;
}> {
  return request(
    token,
    `${lodgePath(lodgeId, "/expense/category")}?${buildQuery({ active, page: String(options.page), per_page: String(options.perPage) })}`,
  );
}

export function createExpenseCategory(
  token: string,
  lodgeId: string,
  input: CreateExpenseCategoryInput,
): Promise<ExpenseCategory> {
  return request(token, lodgePath(lodgeId, "/expense/category"), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getExpenseCategory(
  token: string,
  lodgeId: string,
  categoryId: string,
): Promise<ExpenseCategory> {
  requireIds(categoryId);
  return request(
    token,
    lodgePath(lodgeId, `/expense/category/${encodeURIComponent(categoryId)}`),
  );
}

export function listFinancialPeriods(
  token: string,
  lodgeId: string,
  options: PageOptions & { status?: "open" | "closed" },
): Promise<FinancialPeriodPage> {
  const query = buildQuery({
    page: String(options.page),
    per_page: String(options.perPage),
    status: options.status,
  });
  return request(token, `${lodgePath(lodgeId, "/financial/periods")}?${query}`);
}

export function getFinancialPeriod(
  token: string,
  lodgeId: string,
  periodId: string,
): Promise<FinancialPeriodDetail> {
  requireIds(periodId);
  return request(
    token,
    lodgePath(lodgeId, `/financial/periods/${encodeURIComponent(periodId)}`),
  );
}

export function listExpenseMembers(
  token: string,
  lodgeId: string,
  options: PageOptions,
): Promise<MemberPage> {
  const query = buildQuery({
    page: String(options.page),
    per_page: String(options.perPage),
    statuses: "ativo,afastado",
  });
  return request(token, `${lodgePath(lodgeId, "/members")}?${query}`);
}

export function getExpenseMember(
  token: string,
  lodgeId: string,
  memberId: string,
): Promise<MemberPage["results"][number]> {
  requireIds(memberId);
  return request(
    token,
    lodgePath(lodgeId, `/member/${encodeURIComponent(memberId)}`),
  );
}

export function updateExpenseCategory(
  token: string,
  lodgeId: string,
  categoryId: string,
  input: { label?: string; active?: boolean },
): Promise<ExpenseCategory> {
  requireIds(categoryId);
  return request(
    token,
    lodgePath(lodgeId, `/expense/category/${encodeURIComponent(categoryId)}`),
    { method: "PATCH", body: JSON.stringify(input) },
  );
}
