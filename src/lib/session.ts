import { computed, ref } from "vue";
import { ApiError, getMe, login, type UserProfile } from "@/domain/auth/api";
import { onSessionInvalidated } from "@/domain/auth/session-events";
export const user = ref<UserProfile | null>(null);
export const token = ref("");
export const lodgeId = ref("");
export const expiresAt = ref(0);
export const sessionNotice = ref("");
export const lodge = computed(() =>
  user.value?.lodges.find((l) => l.id === lodgeId.value),
);
let timer: ReturnType<typeof setTimeout> | undefined;
let revision = 0;
const KEY = "entre-colunas.web.session";
export function signOut(message = "") {
  revision++;
  clearTimeout(timer);
  token.value = "";
  expiresAt.value = 0;
  user.value = null;
  lodgeId.value = "";
  sessionNotice.value = message;
  sessionStorage.removeItem(KEY);
  // Pending intents contain personal/financial data and belong to the session.
  for (const key of Object.keys(sessionStorage))
    if (key.startsWith("entre-colunas.")) sessionStorage.removeItem(key);
}
export function checkExpiry() {
  if (token.value && Date.now() >= expiresAt.value)
    signOut("Sua sessão expirou. Entre novamente.");
}
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(
    () => {
      checkExpiry();
      if (token.value) schedule();
    },
    Math.min(Math.max(0, expiresAt.value - Date.now()), 2147483647),
  );
}
export function selectLodge(id: string) {
  if (!user.value?.lodges.some((l) => l.id === id)) return;
  lodgeId.value = id;
  persist();
}
function persist() {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({
      token: token.value,
      expiresAt: expiresAt.value,
      lodgeId: lodgeId.value,
    }),
  );
}
export async function signIn(email: string, password: string) {
  const attempt = ++revision;
  const response = await login(email, password);
  if (
    !response.token?.trim() ||
    !Number.isFinite(response.ttl) ||
    response.ttl <= 0
  )
    throw new Error("A API retornou uma sessão inválida.");
  const expiration = Date.now() + response.ttl * 1000;
  const profile = await getMe(response.token);
  if (attempt !== revision) return;
  user.value = profile.user;
  token.value = response.token;
  expiresAt.value = expiration;
  lodgeId.value = profile.user.lodges[0]?.id ?? "";
  sessionNotice.value = "";
  persist();
  schedule();
}
export async function restoreSession() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (
      !stored ||
      typeof stored.token !== "string" ||
      !stored.token.trim() ||
      !Number.isFinite(stored.expiresAt) ||
      stored.expiresAt <= Date.now()
    ) {
      signOut();
      return;
    }
    const attempt = ++revision;
    token.value = stored.token;
    expiresAt.value = stored.expiresAt;
    schedule();
    const profile = await getMe(stored.token);
    if (attempt !== revision) return;
    user.value = profile.user;
    lodgeId.value = profile.user.lodges.some((l) => l.id === stored.lodgeId)
      ? stored.lodgeId
      : (profile.user.lodges[0]?.id ?? "");
  } catch (error) {
    if (error instanceof ApiError && error.kind === "network") {
      // A network outage is not a logout: keep the stored session and pending
      // idempotency keys so a reload after reconnection can recover the result.
      revision++;
      clearTimeout(timer);
      token.value = "";
      user.value = null;
      lodgeId.value = "";
      expiresAt.value = 0;
      sessionNotice.value =
        "Não foi possível verificar sua sessão. Confira a conexão e recarregue a página.";
      return;
    }
    signOut("Não foi possível recuperar a sessão. Entre novamente.");
  }
}
onSessionInvalidated((invalid) => {
  if (invalid === token.value) signOut("Sua sessão expirou. Entre novamente.");
});
if (typeof document !== "undefined")
  document.addEventListener("visibilitychange", checkExpiry);
