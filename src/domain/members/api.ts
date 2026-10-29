import { apiUrl } from "../../lib/runtime-config";
import { ApiError, getMe } from "@/domain/auth/api";
import { invalidateSession } from "@/domain/auth/session-events";

export type MemberStatus = {
  id: string;
  label: string;
  slug: string;
};

export type MemberStatusOption = MemberStatus & {
  active: boolean;
};

export type Member = {
  id: string;
  name: string;
  phone: string | null;
  agape_participant: boolean;
  lodge_beggin: string;
  status: MemberStatus;
};

export type MemberPage = {
  results: Member[];
  total: number;
  page: number;
  per_page: number;
};

export type MemberInput = {
  name: string;
  phone?: string | null;
  agape_participant?: boolean;
  lodge_beggin?: string;
  member_status_slug?: string;
};

export type MemberPatch = Partial<MemberInput>;
export type MemberMessage = { message: string };

const apiBaseUrl = () => {
  const value = apiUrl?.trim();
  if (!value) {
    throw new ApiError(
      "A API não está configurada. Defina VITE_API_URL e reinicie o aplicativo.",
      undefined,
      "configuration",
    );
  }
  return value.replace(/\/+$/, "");
};

async function request<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (!token.trim())
    throw new ApiError(
      "Sua sessão expirou. Entre novamente.",
      undefined,
      "unauthorized",
    );
  const url = `${apiBaseUrl()}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: init?.signal ?? AbortSignal.timeout(20000),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init?.headers,
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
    // Lodge access failures also use 503. Only /me can confirm an invalid session.
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
      );
    if (response.status === 404)
      throw new ApiError(
        "Este membro não foi encontrado. Atualize a lista e tente novamente.",
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
  return payload as T;
}

export function listMembers(
  token: string,
  lodgeId: string,
  options: { page: number; perPage: number; statuses?: string[] },
): Promise<MemberPage> {
  if (!lodgeId.trim())
    throw new ApiError(
      "Selecione uma loja para continuar.",
      undefined,
      "configuration",
    );
  const query = new URLSearchParams({
    page: String(options.page),
    per_page: String(options.perPage),
  });
  if (options.statuses?.length)
    query.set("statuses", options.statuses.join(","));
  return request(
    token,
    `/lodge/${encodeURIComponent(lodgeId)}/members?${query.toString()}`,
  );
}

export function listMemberStatuses(
  token: string,
): Promise<MemberStatusOption[]> {
  return request(token, "/member-statuses");
}

export function getMember(
  token: string,
  lodgeId: string,
  memberId: string,
): Promise<Member> {
  if (!lodgeId.trim())
    throw new ApiError(
      "Selecione uma loja para continuar.",
      undefined,
      "configuration",
    );
  return request(
    token,
    `/lodge/${encodeURIComponent(lodgeId)}/member/${encodeURIComponent(memberId)}`,
  );
}

export function createMember(
  token: string,
  lodgeId: string,
  input: MemberInput,
): Promise<Member> {
  if (!lodgeId.trim())
    throw new ApiError(
      "Selecione uma loja para continuar.",
      undefined,
      "configuration",
    );
  return request(token, `/lodge/${encodeURIComponent(lodgeId)}/member`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateMember(
  token: string,
  lodgeId: string,
  memberId: string,
  patch: MemberPatch,
): Promise<Member> {
  if (!lodgeId.trim())
    throw new ApiError(
      "Selecione uma loja para continuar.",
      undefined,
      "configuration",
    );
  return request(
    token,
    `/lodge/${encodeURIComponent(lodgeId)}/member/${encodeURIComponent(memberId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );
}

export function archiveMember(
  token: string,
  lodgeId: string,
  memberId: string,
): Promise<MemberMessage> {
  if (!lodgeId.trim())
    throw new ApiError(
      "Selecione uma loja para continuar.",
      undefined,
      "configuration",
    );
  return request(
    token,
    `/lodge/${encodeURIComponent(lodgeId)}/member/${encodeURIComponent(memberId)}/archive`,
    {
      method: "PATCH",
    },
  );
}

export function deleteMember(
  token: string,
  lodgeId: string,
  memberId: string,
): Promise<MemberMessage> {
  if (!lodgeId.trim())
    throw new ApiError(
      "Selecione uma loja para continuar.",
      undefined,
      "configuration",
    );
  return request(
    token,
    `/lodge/${encodeURIComponent(lodgeId)}/member/${encodeURIComponent(memberId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function getMemberPaymentRecency(
  token: string,
  lodgeId: string,
  memberIds: string[],
): Promise<import("./payment-recency").PaymentRecency[]> {
  const response = await request<{
    masonic_lodge_id: string;
    calculated_at: string;
    results: import("./payment-recency").PaymentRecency[];
  }>(
    token,
    `/lodge/${encodeURIComponent(lodgeId)}/members/payment-recency?${new URLSearchParams({ member_ids: memberIds.join(",") })}`,
  );
  if (
    response.masonic_lodge_id !== lodgeId ||
    !Number.isFinite(Date.parse(response.calculated_at)) ||
    !Array.isArray(response.results) ||
    response.results.length !== memberIds.length ||
    new Set(response.results.map((item) => item.member_id)).size !==
      memberIds.length ||
    response.results.some(
      (item) =>
        !memberIds.includes(item.member_id) ||
        !(
          (item.days_since_last_payment === null &&
            item.last_payment_at === null &&
            item.reference_at === null &&
            item.reference_source === null) ||
          (Number.isSafeInteger(item.days_since_last_payment) &&
            Number(item.days_since_last_payment) >= 0 &&
            typeof item.reference_at === "string" &&
            Number.isFinite(Date.parse(item.reference_at)) &&
            [
              "member_payment",
              "adjustment",
              "opening_balance",
              "first_period",
            ].includes(item.reference_source ?? "") &&
            (item.reference_source === "first_period"
              ? item.last_payment_at === null
              : item.last_payment_at === item.reference_at))
        ),
    )
  )
    throw new Error(
      "O indicador de pagamentos está indisponível. Tente novamente.",
    );
  return response.results;
}
