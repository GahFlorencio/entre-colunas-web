import { apiUrl } from "../../lib/runtime-config";
import { ApiError, getMe } from "@/domain/auth/api";
import { invalidateSession } from "@/domain/auth/session-events";
import {
  classifyFinancial503,
  unavailableFinancialValuesError,
} from "@/domain/financial/financial-503";
import type {
  CloseFinancialPeriodResponse,
  FinancialPeriod,
  FinancialPeriodDetail,
  FinancialPeriodPage,
  FinancialPeriodPreview,
  PreviewFinancialPeriodInput,
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
          "Este período não foi encontrado. Atualize os dados e tente novamente.",
        404,
        "not-found",
      );
    if (response.status === 409)
      throw new ApiError(
        message ??
          "O estado do período mudou. Atualize os dados e revise antes de tentar novamente.",
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

/** Opening is an explicit collection POST with no request body or idempotency key. */
export function openFinancialPeriod(
  token: string,
  lodgeId: string,
): Promise<FinancialPeriod> {
  return request(token, lodgePath(lodgeId, "/financial/periods"), {
    method: "POST",
  });
}

/** The preview applies to the currently open period; the API accepts no period ID. */
export function previewFinancialPeriod(
  token: string,
  lodgeId: string,
  input: PreviewFinancialPeriodInput,
): Promise<FinancialPeriodPreview> {
  return request(token, lodgePath(lodgeId, "/financial/periods/preview"), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function closeFinancialPeriod(
  token: string,
  lodgeId: string,
  periodId: string,
  input: PreviewFinancialPeriodInput,
  idempotencyKey: string,
): Promise<CloseFinancialPeriodResponse> {
  requireIds(periodId, idempotencyKey);
  return request(
    token,
    lodgePath(
      lodgeId,
      `/financial/periods/${encodeURIComponent(periodId)}/close`,
    ),
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    },
  );
}

export function getPeriodReport(
  token: string,
  lodgeId: string,
  periodId: string,
  acrescimo?: number,
): Promise<import("./types").PeriodReport> {
  requireIds(periodId);
  if (
    acrescimo !== undefined &&
    (!Number.isFinite(acrescimo) ||
      acrescimo < 0 ||
      Math.round(acrescimo * 100) / 100 !== acrescimo)
  )
    throw new ApiError(
      "Informe um acréscimo válido, a partir de zero e com até duas casas decimais.",
      400,
      "validation",
    );
  return request(
    token,
    lodgePath(
      lodgeId,
      `/financial/periods/${encodeURIComponent(periodId)}/report${acrescimo === undefined ? "" : `?acrescimo=${encodeURIComponent(acrescimo)}`}`,
    ),
  );
}
