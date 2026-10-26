import { ApiError } from "@/domain/auth/api";

export type Financial503Classification =
  "authorization" | "unavailable" | "unknown";

/**
 * The API currently publishes these two error messages without stable error codes.
 * Treat every other 503 body as a recoverable operational failure; status alone
 * does not establish that the user's lodge access or session was revoked.
 */
export function classifyFinancial503(
  payload: unknown,
): Financial503Classification {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload))
    return "unknown";
  const error = (payload as Record<string, unknown>).error;
  if (error === "Usuário não autorizado") return "authorization";
  if (error === "Valores financeiros indisponíveis") return "unavailable";
  return "unknown";
}

export function unavailableFinancialValuesError(): ApiError {
  return new ApiError(
    "Os valores financeiros estão temporariamente indisponíveis. Tente novamente.",
    503,
    "server",
  );
}
