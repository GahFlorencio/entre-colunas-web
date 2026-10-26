import { apiUrl } from "./runtime-config";
import { ref, computed, watch } from "vue";
import { newIntentKey } from "./intent-key";
import { token, user, lodgeId, checkExpiry } from "./session";
import { invalidateSession } from "@/domain/auth/session-events";
import { classifyFinancial503 } from "@/domain/financial/financial-503";
import { ApiError, getMe } from "@/domain/auth/api";
export type PendingWrite = {
  userId: string;
  lodgeId: string;
  path: string;
  method: "POST" | "PATCH";
  bodyJson: string;
  key: string;
};
export const pendingWrite = ref<PendingWrite | null>(null);
export const writeBusy = ref(false);
export const writeVersion = ref(0);
const storageKey = computed(
  () => `entre-colunas.pending.${user.value?.id}.${lodgeId.value}`,
);
watch(
  storageKey,
  (key) => {
    try {
      const value = JSON.parse(
        sessionStorage.getItem(key) || "null",
      ) as PendingWrite | null;
      pendingWrite.value =
        value &&
        value.userId === user.value?.id &&
        value.lodgeId === lodgeId.value &&
        value.path.startsWith(`/lodge/${encodeURIComponent(lodgeId.value)}/`) &&
        ["POST", "PATCH"].includes(value.method) &&
        typeof value.bodyJson === "string" &&
        typeof value.key === "string"
          ? value
          : null;
    } catch {
      pendingWrite.value = null;
    }
  },
  { immediate: true },
);
export async function financialWrite<T>(
  path: string,
  method: "POST" | "PATCH",
  body: unknown,
): Promise<T> {
  checkExpiry();
  if (!token.value || !user.value)
    throw new Error("Sua sessão expirou. Entre novamente.");
  if (!navigator.onLine)
    throw new Error("Conecte-se à internet para salvar este lançamento.");
  if (writeBusy.value)
    throw new Error("Um lançamento está sendo processado. Aguarde.");
  const bodyJson = JSON.stringify(body);
  if (pendingWrite.value) {
    if (
      pendingWrite.value.path !== path ||
      pendingWrite.value.method !== method ||
      pendingWrite.value.bodyJson !== bodyJson
    )
      throw new Error(
        "Há um lançamento com resultado pendente. Use “Verificar lançamento pendente” antes de fazer outra alteração.",
      );
  } else {
    const pending: PendingWrite = {
      userId: user.value.id,
      lodgeId: lodgeId.value,
      path,
      method,
      bodyJson,
      key: newIntentKey(),
    };
    sessionStorage.setItem(storageKey.value, JSON.stringify(pending));
    pendingWrite.value = pending;
  }
  return replayPending<T>();
}
export async function replayPending<T>(): Promise<T> {
  checkExpiry();
  const pending = pendingWrite.value,
    accessToken = token.value,
    key = storageKey.value;
  if (
    !pending ||
    !accessToken ||
    pending.userId !== user.value?.id ||
    pending.lodgeId !== lodgeId.value
  )
    throw new Error("Não há lançamento pendente nesta sessão.");
  if (writeBusy.value) throw new Error("Aguarde a verificação em andamento.");
  writeBusy.value = true;
  try {
    const response = await fetch(
      `${apiUrl.replace(/\/+$/, "")}${pending.path}`,
      {
        method: pending.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Idempotency-Key": pending.key,
        },
        body: pending.bodyJson,
        signal: AbortSignal.timeout(30000),
      },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) invalidateSession(accessToken);
      if (
        response.status === 503 &&
        classifyFinancial503(payload) === "authorization"
      )
        await getMe(accessToken).catch(() => undefined);
      // Definitive validation failures did not create a posting. Unknown server outcomes retain the exact intent.
      if ([400, 401, 403, 404, 409, 422].includes(response.status)) {
        sessionStorage.removeItem(key);
        if (pendingWrite.value?.key === pending.key) pendingWrite.value = null;
      }
      const detail = Array.isArray(payload?.message)
        ? payload.message.join(". ")
        : payload?.message || payload?.error;
      throw new ApiError(
        detail ||
          "Não foi possível confirmar o lançamento. Verifique o resultado pendente.",
        response.status,
      );
    }
    if (payload === null)
      throw new Error(
        "A resposta não pôde ser confirmada. Verifique o lançamento pendente.",
      );
    sessionStorage.removeItem(key);
    if (pendingWrite.value?.key === pending.key) pendingWrite.value = null;
    writeVersion.value++;
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error(
      "O resultado do lançamento não pôde ser confirmado. Use “Verificar lançamento pendente”; a mesma chave será reutilizada para evitar duplicação.",
    );
  } finally {
    writeBusy.value = false;
  }
}
export const lodgePath = (suffix: string) =>
  `/lodge/${encodeURIComponent(lodgeId.value)}${suffix}`;
