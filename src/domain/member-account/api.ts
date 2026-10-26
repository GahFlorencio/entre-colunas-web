import { apiUrl } from "../../lib/runtime-config";
import { ApiError, getMe } from "@/domain/auth/api";
import { invalidateSession } from "@/domain/auth/session-events";
import {
  classifyFinancial503,
  unavailableFinancialValuesError,
} from "@/domain/financial/financial-503";
import type {
  MemberAccountMovement,
  MemberAccountMovementOptions,
  MemberAccountMovementPage,
} from "./types";

const DEFAULT_PER_PAGE = 10;
const ID_PATTERN = /^[1-9]\d*$/;

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

function requireId(value: string, name: string): void {
  if (!ID_PATTERN.test(value))
    throw new ApiError(`${name} inválido.`, 400, "validation");
}

function invalidResponse(): ApiError {
  return new ApiError(
    "A API retornou dados de extrato incompatíveis. Atualize e tente novamente.",
    undefined,
    "invalid-response",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function movementFrom(value: unknown): MemberAccountMovement {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !ID_PATTERN.test(value.id) ||
    typeof value.financial_operation_id !== "string" ||
    !ID_PATTERN.test(value.financial_operation_id) ||
    typeof value.financial_period_id !== "string" ||
    !ID_PATTERN.test(value.financial_period_id) ||
    (value.direction !== "debit" && value.direction !== "credit") ||
    typeof value.value !== "number" ||
    !Number.isFinite(value.value) ||
    typeof value.description !== "string" ||
    !(
      typeof value.category_label === "string" || value.category_label === null
    ) ||
    typeof value.operation_type !== "string" ||
    typeof value.created_at !== "string" ||
    Number.isNaN(Date.parse(value.created_at))
  ) {
    throw invalidResponse();
  }
  return {
    id: value.id,
    financial_operation_id: value.financial_operation_id,
    financial_period_id: value.financial_period_id,
    direction: value.direction,
    value: value.value,
    description: value.description,
    category_label: value.category_label,
    operation_type: value.operation_type,
    created_at: value.created_at,
  };
}

function pageFrom(
  value: unknown,
  expectedMemberId: string,
): MemberAccountMovementPage {
  if (
    !isRecord(value) ||
    !Array.isArray(value.results) ||
    !Number.isSafeInteger(value.total) ||
    Number(value.total) < 0 ||
    !isPositiveInteger(value.page) ||
    !isPositiveInteger(value.per_page) ||
    typeof value.balance !== "number" ||
    !Number.isFinite(value.balance) ||
    value.account_type !== "member" ||
    typeof value.member_id !== "string" ||
    !ID_PATTERN.test(value.member_id) ||
    value.member_id !== expectedMemberId ||
    !Object.hasOwn(value, "totals")
  ) {
    throw invalidResponse();
  }
  return {
    results: value.results.map(movementFrom),
    total: Number(value.total),
    page: Number(value.page),
    per_page: Number(value.per_page),
    balance: value.balance,
    account_type: "member",
    member_id: value.member_id,
    totals: value.totals,
  };
}

export async function requestMemberAccountResource(
  token: string,
  path: string,
  signal?: AbortSignal,
): Promise<unknown> {
  if (!token.trim())
    throw new ApiError(
      "Sua sessão expirou. Entre novamente.",
      undefined,
      "unauthorized",
    );
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method: "GET",
      cache: "no-store",
      signal: signal ?? AbortSignal.timeout(20000),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
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
    const body = isRecord(payload) ? payload : null;
    const rawMessage = body?.message ?? body?.error;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join(". ")
      : typeof rawMessage === "string"
        ? rawMessage
        : undefined;
    if (response.status === 400)
      throw new ApiError(
        message ?? "Confira as datas e tente novamente.",
        400,
        "validation",
      );
    if (response.status === 404)
      throw new ApiError(
        message ?? "Este membro não foi encontrado nesta loja.",
        404,
        "not-found",
      );
    throw new ApiError(
      message ??
        "O serviço está temporariamente indisponível. Tente novamente.",
      response.status,
      "server",
    );
  }
  if (payload === null) throw invalidResponse();
  return payload;
}

export function listMemberAccountMovements(
  token: string,
  lodgeId: string,
  memberId: string,
  options: MemberAccountMovementOptions = {},
): Promise<MemberAccountMovementPage> {
  requireId(lodgeId, "Loja");
  requireId(memberId, "Membro");
  const page = options.page ?? 1;
  const perPage = options.perPage ?? DEFAULT_PER_PAGE;
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(perPage) ||
    perPage < 1 ||
    perPage > 100
  ) {
    throw new ApiError("A página do extrato é inválida.", 400, "validation");
  }
  const query = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  if (options.from !== undefined) query.set("from", options.from);
  if (options.to !== undefined) query.set("to", options.to);
  const path = `/lodge/${encodeURIComponent(lodgeId)}/member/${encodeURIComponent(memberId)}/financial/account/movements?${query}`;
  return requestMemberAccountResource(token, path).then((payload) =>
    pageFrom(payload, memberId),
  );
}
