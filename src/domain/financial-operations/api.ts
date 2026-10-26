import { apiUrl } from "../../lib/runtime-config";
import { ApiError, getMe } from "@/domain/auth/api";
import { invalidateSession } from "@/domain/auth/session-events";
import {
  classifyFinancial503,
  unavailableFinancialValuesError,
} from "@/domain/financial/financial-503";
import type {
  PaymentInput,
  IncomeInput,
  AdjustmentInput,
  ReversalInput,
  OperationFilters,
} from "./types";
import { detailFrom, pageFrom, summaryFrom } from "./validation";

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
  if (ids.some((id) => !/^[1-9]\d*$/.test(id)))
    throw new ApiError("Identificador inválido.", 400, "validation");
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
  const payload: unknown = await response.json().catch(() => null);
  if (response.status === 503) {
    if (classifyFinancial503(payload) !== "authorization")
      throw unavailableFinancialValuesError();
    try {
      await getMe(token);
      throw new ApiError(
        "Você não tem autorização para acessar esta loja.",
        503,
        "unauthorized",
      );
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 503 &&
        error.message.includes("autorização")
      )
        throw error;
      if (
        error instanceof ApiError &&
        (error.kind === "unauthorized" ||
          error.kind === "not-found" ||
          error.status === 401)
      ) {
        throw new ApiError(
          "Sua sessão expirou. Entre novamente.",
          error.status,
          "unauthorized",
        );
      }
      throw new ApiError(
        "Não foi possível confirmar o acesso à loja. Tente novamente.",
        503,
        error instanceof ApiError && error.kind === "network"
          ? "network"
          : "server",
      );
    }
  }
  if (!response.ok) {
    const body = payload as {
      message?: string | string[];
      error?: string;
      impediments?: unknown;
    } | null;
    const details = Array.isArray(body?.message) ? body.message : undefined;
    const message =
      (Array.isArray(body?.message)
        ? body.message.join(". ")
        : body?.message) ?? body?.error;
    const impediments = Array.isArray(body?.impediments)
      ? body.impediments.filter(
          (item): item is string => typeof item === "string",
        )
      : undefined;
    if (response.status === 400)
      throw new ApiError(
        message ?? "Confira os dados informados e tente novamente.",
        400,
        "validation",
        details,
      );
    if (response.status === 404)
      throw new ApiError(
        message ??
          "O registro financeiro não foi encontrado. Atualize os dados e tente novamente.",
        404,
        "not-found",
      );
    if (response.status === 409)
      throw new ApiError(
        message ??
          "Esta operação entrou em conflito. Atualize os dados e revise antes de tentar novamente.",
        409,
        "conflict",
        undefined,
        impediments,
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
function post(token: string, path: string, body: object, key: string) {
  if (!key.trim() || key.length > 255)
    throw new ApiError("Chave idempotente inválida.", 400, "validation");
  return request<unknown>(token, path, {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify(body),
  }).then(summaryFrom);
}
export function createMemberPayment(
  token: string,
  lodgeId: string,
  memberId: string,
  input: PaymentInput,
  key: string,
) {
  requireIds(memberId);
  return post(
    token,
    lodgePath(
      lodgeId,
      `/member/${encodeURIComponent(memberId)}/financial/payments`,
    ),
    { value: input.value, description: input.description },
    key,
  );
}
export function createLodgeIncome(
  token: string,
  lodgeId: string,
  input: IncomeInput,
  key: string,
) {
  return post(
    token,
    lodgePath(lodgeId, "/financial/incomes"),
    {
      value: input.value,
      description: input.description,
      expense_category_id: input.expense_category_id,
    },
    key,
  );
}
function adjustmentBody(input: AdjustmentInput): AdjustmentInput {
  return {
    kind: input.kind,
    direction: input.direction,
    value: input.value,
    description: input.description,
    justification: input.justification,
    ...(input.source_entry_id === undefined
      ? {}
      : { source_entry_id: input.source_entry_id }),
  };
}
export function createLodgeAdjustment(
  token: string,
  lodgeId: string,
  input: AdjustmentInput,
  key: string,
) {
  return post(
    token,
    lodgePath(lodgeId, "/financial/adjustments"),
    adjustmentBody(input),
    key,
  );
}
export function createMemberAdjustment(
  token: string,
  lodgeId: string,
  memberId: string,
  input: AdjustmentInput,
  key: string,
) {
  requireIds(memberId);
  return post(
    token,
    lodgePath(
      lodgeId,
      `/member/${encodeURIComponent(memberId)}/financial/adjustments`,
    ),
    adjustmentBody(input),
    key,
  );
}
export function reverseFinancialOperation(
  token: string,
  lodgeId: string,
  operationId: string,
  input: ReversalInput,
  key: string,
) {
  requireIds(operationId);
  return post(
    token,
    lodgePath(
      lodgeId,
      `/financial/operations/${encodeURIComponent(operationId)}/reversals`,
    ),
    { description: input.description, justification: input.justification },
    key,
  );
}
export function getFinancialOperation(
  token: string,
  lodgeId: string,
  operationId: string,
) {
  requireIds(operationId);
  return request<unknown>(
    token,
    lodgePath(
      lodgeId,
      `/financial/operations/${encodeURIComponent(operationId)}`,
    ),
  ).then((value) => {
    const detail = detailFrom(value);
    if (detail.id !== operationId)
      throw new ApiError(
        "A operação retornada não corresponde à origem solicitada.",
        undefined,
        "invalid-response",
      );
    return detail;
  });
}
export function listFinancialOperations(
  token: string,
  lodgeId: string,
  options: { page?: number; perPage?: number; filters?: OperationFilters } = {},
) {
  const page = options.page ?? 1,
    perPage = options.perPage ?? 10;
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(perPage) ||
    perPage < 1 ||
    perPage > 100
  )
    throw new ApiError("Paginação inválida.", 400, "validation");
  const filters = options.filters;
  if (filters?.member_id !== undefined) requireIds(filters.member_id);
  if (filters?.financial_period_id !== undefined)
    requireIds(filters.financial_period_id);
  const query = buildQuery({
    page: String(page),
    per_page: String(perPage),
    type: filters?.type,
    member_id: filters?.member_id,
    financial_period_id: filters?.financial_period_id,
  });
  return request<unknown>(
    token,
    `${lodgePath(lodgeId, "/financial/operations")}?${query}`,
  ).then((value) => {
    const result = pageFrom(value);
    if (
      result.page !== page ||
      result.per_page !== perPage ||
      result.results.some(
        (item) =>
          (filters?.member_id !== undefined &&
            item.member_id !== filters.member_id) ||
          (filters?.type !== undefined && item.type !== filters.type) ||
          (filters?.financial_period_id !== undefined &&
            item.financial_period_id !== filters.financial_period_id),
      )
    )
      throw new ApiError(
        "A página retornada não corresponde aos filtros solicitados.",
        undefined,
        "invalid-response",
      );
    return result;
  });
}

/** Replay the persisted request verbatim; the store validates its action/path/body. */
export function sendPostingRequest(
  token: string,
  operation: import("@/domain/financial/pending-operation-store").FinancialPostingPendingOperation,
) {
  return request<unknown>(token, operation.path, {
    method: operation.method,
    headers: { "Idempotency-Key": operation.idempotencyKey },
    body: operation.bodyJson,
  }).then(summaryFrom);
}
