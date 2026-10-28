import { apiUrl } from "@/lib/runtime-config";
import { ApiError } from "@/domain/auth/api";
import { invalidateSession } from "@/domain/auth/session-events";
export type Authority = { id: string; label: string; name: string };
export type AdminLodge = {
  id: string;
  label: string;
  number: string;
  juridical_document: string | null;
  masonic_authority: Authority;
};
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  is_admin: boolean;
};
export type Association = { id: string; user: AdminUser; lodge: AdminLodge };
export type AdminResources = {
  authorities: Authority;
  lodges: AdminLodge;
  users: AdminUser;
  "user-lodges": Association;
};
export type Resource = keyof AdminResources;
export type Page<T> = {
  results: T[];
  total: number;
  page: number;
  per_page: number;
};
export type AdminInputs = {
  authorities: { label: string; name: string };
  lodges: {
    label: string;
    number: string;
    masonic_authority_id: string;
    juridical_document?: string;
  };
  users: { name: string; email: string; password: string };
  "user-lodges": { user_id: string; masonic_lodge_id: string };
};
async function request<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!apiUrl?.trim())
    throw new ApiError(
      "A API não está configurada.",
      undefined,
      "configuration",
    );
  let response: Response;
  try {
    response = await fetch(`${apiUrl.replace(/\/+$/, "")}/admin/${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new ApiError(
      "Não foi possível conectar à API. Verifique sua conexão e tente novamente.",
      undefined,
      "network",
    );
  }
  if (response.status === 401 || response.status === 503) {
    invalidateSession(token);
    throw new ApiError(
      "Sua sessão expirou. Entre novamente.",
      response.status,
      "unauthorized",
    );
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.message;
    throw new ApiError(
      response.status === 403
        ? "Acesso restrito a administradores ativos."
        : Array.isArray(detail)
          ? detail.join(" ")
          : typeof detail === "string"
            ? detail
            : "Não foi possível concluir a operação.",
      response.status,
    );
  }
  return payload as T;
}
export function listAdmin<K extends Resource>(
  token: string,
  resource: K,
  page = 1,
  perPage = 20,
): Promise<Page<AdminResources[K]>> {
  return request(token, `${resource}?page=${page}&per_page=${perPage}`);
}
export function createAdmin<K extends Resource>(
  token: string,
  resource: K,
  input: AdminInputs[K],
): Promise<AdminResources[K]> {
  return request(token, resource, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export async function adminOptions<
  K extends "authorities" | "lodges" | "users",
>(token: string, resource: K): Promise<AdminResources[K][]> {
  const rows: AdminResources[K][] = [];
  let page = 1;
  while (true) {
    const result = await listAdmin(token, resource, page++, 100);
    rows.push(...result.results);
    if (rows.length >= result.total || !result.results.length) return rows;
  }
}
