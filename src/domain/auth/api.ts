import { apiUrl } from "../../lib/runtime-config";
import { invalidateSession } from "@/domain/auth/session-events";

export type LoginResponse = { token: string; type: "Bearer"; ttl: number };

export type MasonicAuthority = { id: string; label: string; name: string };
export type Lodge = {
  id: string;
  label: string;
  number: string;
  juridical_document: unknown | null;
  masonic_authority: MasonicAuthority;
};
export type UserProfile = {
  is_admin: boolean;
  id: string;
  name: string;
  email: string;
  lodges: Lodge[];
};
export type MeResponse = { user: UserProfile };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly kind:
      | "validation"
      | "credentials"
      | "not-found"
      | "conflict"
      | "invalid-response"
      | "unauthorized"
      | "server"
      | "network"
      | "configuration" = "server",
    readonly fields?: string[],
    readonly impediments?: string[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function apiBaseUrl(): string {
  const value = apiUrl?.trim();
  if (!value) {
    throw new ApiError(
      "A API não está configurada. Defina VITE_API_URL e reinicie o aplicativo.",
      undefined,
      "configuration",
    );
  }
  return value.replace(/\/+$/, "");
}

async function request<T>(
  path: string,
  init?: RequestInit,
  token?: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      cache: "no-store",
      signal: init?.signal ?? AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(
      "Não foi possível conectar à API. Verifique sua conexão e tente novamente.",
      undefined,
      "network",
    );
  }
  if (
    token &&
    (response.status === 401 ||
      response.status === 503 ||
      response.status === 404)
  ) {
    invalidateSession(token);
    throw new ApiError(
      "Sua sessão expirou. Entre novamente.",
      response.status,
      "unauthorized",
    );
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const body = payload as {
      error?: string;
      message?: string | string[];
    } | null;
    const details = Array.isArray(body?.message) ? body.message : undefined;
    if (response.status === 400) {
      const credentials =
        typeof body?.error === "string" &&
        body.error.toLowerCase().includes("credenciais");
      throw new ApiError(
        credentials
          ? "Email ou senha incorretos. Confira os dados e tente novamente."
          : typeof body?.message === "string"
            ? body.message
            : "Confira os dados informados e tente novamente.",
        400,
        credentials ? "credentials" : "validation",
        details,
      );
    }
    if (response.status === 404)
      throw new ApiError(
        "A conta desta sessão não foi encontrada. Entre novamente.",
        404,
        "not-found",
      );
    if (response.status === 503)
      throw new ApiError(
        "Não foi possível validar o acesso. Tente entrar novamente.",
        503,
        "unauthorized",
      );
    throw new ApiError(
      "O serviço está temporariamente indisponível. Tente novamente.",
      response.status,
      "server",
    );
  }
  return payload as T;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getMe(token: string): Promise<MeResponse> {
  return request<MeResponse>(
    "/me",
    { headers: { Authorization: `Bearer ${token}` } },
    token,
  );
}

export function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  return request<void>(
    "/me/password",
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    },
    token,
  );
}
