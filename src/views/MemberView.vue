<script setup lang="ts">
import { computed, ref, onMounted, onScopeDispose } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowLeft,
  Pencil,
  Archive,
  Ellipsis,
  Trash2,
  ListPlus,
  Phone,
  CalendarDays,
  Utensils,
  UserRoundCheck,
} from "@lucide/vue";
import { token, lodgeId } from "@/lib/session";
import { date, message, money } from "@/lib/format";
import { getMember, archiveMember, deleteMember } from "@/domain/members/api";
import { getMemberAccountBalance } from "@/domain/member-account/api";
import { useQuery } from "@/lib/query";
import QueryState from "@/components/QueryState.vue";
import MemberForm from "@/components/MemberForm.vue";
import Modal from "@/components/Modal.vue";
import MemberPeriods from "@/components/MemberPeriods.vue";
import StatementView from "./StatementView.vue";
import OperationForm from "@/components/OperationForm.vue";
import PaymentRecency from "@/components/PaymentRecency.vue";
import { usePaymentRecency } from "@/domain/members/payment-recency";
const route = useRoute(),
  router = useRouter(),
  edit = ref(false),
  confirmation = ref(""),
  busy = ref(false),
  error = ref(""),
  payment = ref(false);
const id = computed(() => String(route.params.id));
const recency = usePaymentRecency(() => [id.value]);
const tab = ref(route.query.aba === "periodos" ? "periods" : "statement");
const tabs = [
  { key: "statement", label: "Extrato" },
  { key: "periods", label: "Períodos" },
];
function navigateTabs(event: KeyboardEvent) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const current = tabs.findIndex((item) => item.key === tab.value);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
          tabs.length;
  tab.value = tabs[next].key;
  (event.currentTarget as HTMLElement)
    .querySelectorAll<HTMLButtonElement>('[role="tab"]')
    [next]?.focus();
}
const query = useQuery(
  () => getMember(token.value, lodgeId.value, id.value),
  () => id.value,
);
const statusTone = computed(
  () =>
    ({
      ativo: "status-active",
      afastado: "status-away",
      placet: "status-placet",
      inativo: "status-inactive",
    })[query.data.value?.status.slug ?? ""] ?? "status-inactive",
);
const account = useQuery(
  () => getMemberAccountBalance(token.value, lodgeId.value, id.value),
  () => id.value,
);
const payable = computed(
  () => Math.max(0, -Math.round((account.data.value ?? 0) * 100)) / 100,
);
const formattedPhone = computed(() => {
  const raw = query.data.value?.phone?.trim();
  if (!raw) return "Não informado";
  let digits = raw.replace(/\D/g, "");
  const international =
    digits.startsWith("55") && [12, 13].includes(digits.length);
  if (international) digits = digits.slice(2);
  if (![10, 11].includes(digits.length)) return raw;
  return `${international ? "+55 " : ""}(${digits.slice(0, 2)}) ${digits.slice(2, -4)}-${digits.slice(-4)}`;
});
const menu = ref<HTMLDetailsElement>();
const menuButton = ref<HTMLElement>();
function closeMenu() {
  if (menu.value) menu.value.open = false;
}
function outsideMenu(event: MouseEvent) {
  if (!menu.value?.contains(event.target as Node)) closeMenu();
}
onMounted(() => document.addEventListener("click", outsideMenu));
onScopeDispose(() => document.removeEventListener("click", outsideMenu));
function chooseAction(action: string) {
  closeMenu();
  menuButton.value?.focus();
  error.value = "";
  if (action === "edit") edit.value = true;
  else confirmation.value = action;
}
async function act() {
  busy.value = true;
  error.value = "";
  try {
    if (confirmation.value === "archive")
      await archiveMember(token.value, lodgeId.value, id.value);
    else await deleteMember(token.value, lodgeId.value, id.value);
    await router.replace("/membros");
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="member-detail">
    <RouterLink to="/membros" class="back-link"
      ><ArrowLeft aria-hidden="true" :size="16" />Todos os membros</RouterLink
    ><QueryState
      :loading="query.loading.value"
      :error="query.error.value"
      @retry="query.refresh"
      ><template v-if="query.data.value"
        ><section class="member-profile" aria-label="Dados do membro">
          <div class="member-identity">
            <div class="member-name">
              <h1>{{ query.data.value.name }}</h1>
            </div>
            <div class="member-actions">
              <button
                class="member-payment secondary"
                aria-label="Registrar operação"
                title="Registrar operação"
                @click="payment = true"
              >
                <ListPlus :size="21" aria-hidden="true" />
              </button>
              <details
                ref="menu"
                class="member-menu"
                @keydown.esc.prevent="
                  closeMenu();
                  menuButton?.focus();
                "
                @focusout="
                  (event) => {
                    if (!menu?.contains(event.relatedTarget as Node))
                      closeMenu();
                  }
                "
              >
                <summary
                  ref="menuButton"
                  aria-label="Ações do membro"
                  title="Ações do membro"
                >
                  <Ellipsis :size="22" aria-hidden="true" />
                </summary>
                <div class="member-menu-items">
                  <button class="secondary" @click="chooseAction('edit')">
                    <Pencil :size="17" aria-hidden="true" />Editar</button
                  ><button class="secondary" @click="chooseAction('archive')">
                    <Archive :size="17" aria-hidden="true" />Arquivar</button
                  ><button
                    class="secondary delete-action"
                    @click="chooseAction('delete')"
                  >
                    <Trash2 :size="17" aria-hidden="true" />Excluir
                  </button>
                </div>
              </details>
            </div>
          </div>
          <dl class="member-facts">
            <div>
              <dt><Phone :size="14" aria-hidden="true" />Telefone</dt>
              <dd>{{ formattedPhone }}</dd>
            </div>
            <div>
              <dt><CalendarDays :size="14" aria-hidden="true" />Ingresso</dt>
              <dd>{{ date(query.data.value.lodge_beggin) }}</dd>
            </div>
            <div>
              <dt><Utensils :size="14" aria-hidden="true" />Ágape</dt>
              <dd>
                {{ query.data.value.agape_participant ? "Sim" : "Não" }}
              </dd>
            </div>
            <div>
              <dt><UserRoundCheck :size="14" aria-hidden="true" />Situação</dt>
              <dd>
                <span :class="['member-status', statusTone]">{{
                  query.data.value.status.label
                }}</span>
              </dd>
            </div>
          </dl>
          <div
            class="member-finances"
            role="group"
            aria-label="Resumo financeiro"
          >
            <QueryState
              :loading="account.loading.value"
              :error="account.error.value"
              @retry="account.refresh"
              ><template v-if="account.data.value !== null"
                ><div class="member-balance">
                  <span>Saldo atual</span
                  ><strong
                    :class="
                      account.data.value < 0 ? 'amount-debt' : 'amount-credit'
                    "
                    >{{ money(account.data.value) }}</strong
                  >
                </div>
                <div class="member-payable">
                  <span>A pagar</span
                  ><strong
                    :class="payable > 0 ? 'amount-debt' : 'amount-credit'"
                    >{{ money(payable) }}</strong
                  >
                </div></template
              ></QueryState
            >
            <div class="member-recency">
              <PaymentRecency
                :value="recency.byMember.value.get(id)"
                :loading="recency.loading.value"
              />
              <button
                v-if="recency.error.value"
                type="button"
                class="text-button"
                @click="recency.refresh"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </section>
        <div
          class="member-tabs"
          role="tablist"
          aria-label="Detalhes do membro"
          @keydown="navigateTabs"
        >
          <button
            v-for="item in tabs"
            class="secondary"
            :id="`member-tab-${item.key}`"
            :key="item.key"
            role="tab"
            :aria-selected="tab === item.key"
            :aria-controls="`member-panel-${item.key}`"
            :tabindex="tab === item.key ? 0 : -1"
            @click="tab = item.key"
          >
            {{ item.label }}
          </button>
        </div>
        <div
          v-show="tab === 'statement'"
          id="member-panel-statement"
          role="tabpanel"
          aria-labelledby="member-tab-statement"
          tabindex="0"
        >
          <StatementView :key="id" :member-id="id" embedded />
        </div>
        <div
          v-show="tab === 'periods'"
          id="member-panel-periods"
          role="tabpanel"
          aria-labelledby="member-tab-periods"
          tabindex="0"
        >
          <MemberPeriods v-if="tab === 'periods'" :key="id" :member-id="id" />
        </div>
        <MemberForm
          v-if="edit"
          :member="query.data.value"
          @close="edit = false"
          @saved="
            edit = false;
            query.refresh();
          " /><OperationForm
          v-if="payment"
          :member-id="id"
          @close="payment = false"
          @saved="
            payment = false;
            query.refresh();
          " /></template></QueryState
    ><Modal
      v-if="confirmation"
      :title="
        confirmation === 'archive' ? 'Arquivar membro?' : 'Excluir membro?'
      "
      :busy="busy"
      @close="confirmation = ''"
      ><p>
        {{
          confirmation === "archive"
            ? "O membro sairá do quadro ativo. O histórico financeiro será preservado."
            : "A exclusão é permanente e poderá ser recusada pela API se houver vínculos financeiros. Confira o membro antes de continuar."
        }}
      </p>
      <p v-if="error" class="alert" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button class="secondary" :disabled="busy" @click="confirmation = ''">
          Cancelar</button
        ><button class="danger" :disabled="busy" @click="act">
          {{ busy ? "Processando…" : "Confirmar" }}
        </button>
      </div></Modal
    >
  </div>
</template>

<style scoped>
.member-detail {
  min-width: 0;
}
.member-profile {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 20px;
}
.member-identity {
  display: flex;
  align-items: center;
  gap: 12px;
}
.member-name {
  flex: 1;
  min-width: 0;
}
.member-name h1 {
  font-size: 18px;
  line-height: 1.35;
  margin: 0 0 5px;
  overflow-wrap: anywhere;
}
.member-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 500;
  background: color-mix(in srgb, currentColor 9%, var(--surface));
  border-color: color-mix(in srgb, currentColor 20%, var(--border));
  max-width: 100%;
  overflow-wrap: anywhere;
}
.status-active {
  color: var(--success);
}
.status-away {
  color: var(--warning);
}
.status-placet {
  color: var(--danger);
}
.status-inactive {
  color: var(--muted);
}
.member-status::before {
  content: "";
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}
.member-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  align-self: flex-start;
}
.member-menu {
  position: relative;
  align-self: flex-start;
  flex-shrink: 0;
}
.member-menu summary {
  list-style: none;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  cursor: pointer;
  color: var(--text);
}
.member-menu summary::-webkit-details-marker {
  display: none;
}
.member-menu summary:hover {
  background: var(--bg);
}
.member-menu-items {
  position: absolute;
  z-index: 10;
  right: 0;
  top: 48px;
  width: 180px;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 6px;
  background: var(--surface);
  box-shadow: 0 8px 24px #0002;
}
.member-menu-items button.secondary {
  width: 100%;
  justify-content: flex-start;
  border: 0;
  min-height: 44px;
  background: transparent;
}
.member-menu-items button.delete-action {
  color: var(--danger);
}
.member-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
  margin: 12px 0 0;
}
.member-facts div {
  min-width: 0;
}
.member-facts dt {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: 11px;
  margin-bottom: 4px;
}
.member-facts dd {
  font-size: 12px;
  font-weight: 600;
  margin: 0;
  overflow-wrap: anywhere;
}
.member-finances {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  border-top: 1px solid var(--border);
  padding-top: 16px;
  margin-top: 16px;
}
.member-finances :deep(.state) {
  grid-column: 1 / -1;
  padding: 12px;
}
.member-balance,
.member-payable {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.member-finances span {
  font-size: 12px;
  color: var(--muted);
}
.member-finances strong {
  display: block;
  font-size: clamp(23px, 5vw, 28px);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
  letter-spacing: -0.5px;
}
.amount-credit {
  color: var(--success);
}
.amount-debt {
  color: var(--danger);
}
.member-payable {
  border-top: 1px solid var(--border);
  padding-top: 14px;
}
.member-recency {
  min-width: 0;
}
.member-recency :deep(.payment-recency) {
  margin-top: 0;
}
.member-payment.secondary {
  width: 44px;
  height: 44px;
  padding: 0;
  background: var(--gold-bg);
  color: var(--gold);
  border-color: transparent;
}
.member-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  gap: 24px;
  margin-bottom: 18px;
}
.member-tabs button.secondary {
  flex: 0 1 auto;
  min-height: 44px;
  border-radius: 0;
  padding: 8px 2px;
  color: var(--muted);
  border: 0;
  background: transparent;
  border-bottom: 3px solid transparent;
}
.member-tabs button[aria-selected="true"] {
  color: var(--text);
  border-bottom-color: var(--gold);
}
@media (min-width: 768px) {
  .member-profile {
    padding: 18px 20px;
  }
  .member-name h1 {
    font-size: 21px;
  }
  .member-facts {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    max-width: 760px;
  }
  .member-finances {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px;
  }
  .member-payable {
    border-top: 0;
    border-left: 1px solid var(--border);
    padding-top: 0;
    padding-left: 24px;
  }
}
@media (min-width: 1200px) {
  .member-finances {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
