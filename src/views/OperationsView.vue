<script setup lang="ts">
import { computed, reactive, ref, watch, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Plus, Receipt, HandCoins, Funnel } from "@lucide/vue";
import { token, lodgeId } from "@/lib/session";
import { label, date, money } from "@/lib/format";
import { useQuery } from "@/lib/query";
import { listFinancialOperations } from "@/domain/financial-operations/api";
import MovementList, {
  type MovementListItem,
} from "@/components/MovementList.vue";
import QueryState from "@/components/QueryState.vue";
import Pagination from "@/components/Pagination.vue";
import SearchSelect from "@/components/SearchSelect.vue";
import { collectPages } from "@/lib/catalogs";
import { listMembers } from "@/domain/members/api";
import { listFinancialPeriods } from "@/domain/financial-periods/api";
import Modal from "@/components/Modal.vue";
import OperationForm from "@/components/OperationForm.vue";
import CashRegisterIcon from "@/components/CashRegisterIcon.vue";
import { readLodgeFinancialSummary } from "@/domain/lodge-financial/summary-source";
import type { LodgeFinancialSummary } from "@/domain/lodge-financial/summary-state";
const route = useRoute(),
  router = useRouter(),
  showForm = ref(route.query.novo === "1"),
  page = ref(1),
  type = ref(""),
  member = ref(""),
  period = ref("");
const showFilters = ref(false),
  catalogsRequested = ref(false);
const members = useQuery(
  async () => {
    if (!catalogsRequested.value) return null;
    const sessionToken = token.value,
      selectedLodge = lodgeId.value;
    return collectPages((page) =>
      listMembers(sessionToken, selectedLodge, { page, perPage: 100 }),
    );
  },
  () => catalogsRequested.value,
);
const periods = useQuery(
  async () => {
    if (!catalogsRequested.value) return null;
    const sessionToken = token.value,
      selectedLodge = lodgeId.value;
    return collectPages((page) =>
      listFinancialPeriods(sessionToken, selectedLodge, { page, perPage: 100 }),
    );
  },
  () => catalogsRequested.value,
);
const memberOptions = computed(() =>
  (members.data.value?.results || []).map((m) => ({
    value: m.id,
    label: m.name,
    detail: m.status.label,
  })),
);
const periodOptions = computed(() =>
  (periods.data.value?.results || []).map((p) => ({
    value: p.id,
    label: `Período ${p.sequence}`,
    detail: `${p.status === "open" ? "Aberto" : "Fechado"} · ${date(p.opened_at)}`,
  })),
);

const activePicker = ref("");
const viewportHeight = ref(window.visualViewport?.height || window.innerHeight);
const viewportTop = ref(window.visualViewport?.offsetTop || 0);
function updateViewport() {
  viewportHeight.value = window.visualViewport?.height || window.innerHeight;
  viewportTop.value = window.visualViewport?.offsetTop || 0;
}
onMounted(() => {
  window.visualViewport?.addEventListener("resize", updateViewport);
  window.visualViewport?.addEventListener("scroll", updateViewport);
});
onUnmounted(() => {
  window.visualViewport?.removeEventListener("resize", updateViewport);
  window.visualViewport?.removeEventListener("scroll", updateViewport);
});
const draft = reactive({ type: "", member: "", period: "" });
function openFilters() {
  activePicker.value = "";
  updateViewport();
  catalogsRequested.value = true;
  Object.assign(draft, {
    type: type.value,
    member: member.value,
    period: period.value,
  });
  showFilters.value = true;
}
function applyFilters() {
  if (activePicker.value) return;
  type.value = draft.type;
  member.value = draft.member.trim();
  period.value = draft.period.trim();
  showFilters.value = false;
}
const summary = useQuery(
  async () =>
    (await readLodgeFinancialSummary(
      token.value,
      lodgeId.value,
    )) as LodgeFinancialSummary,
);
const filterCount = computed(
  () => [type.value, member.value, period.value].filter(Boolean).length,
);
watch([type, member, period], () => {
  page.value = 1;
});
const query = useQuery(
  () =>
    listFinancialOperations(token.value, lodgeId.value, {
      page: page.value,
      perPage: 20,
      filters: {
        type: type.value || undefined,
        member_id: member.value || undefined,
        financial_period_id: period.value || undefined,
      },
    }),
  () => [page.value, type.value, member.value, period.value],
);
const movementItems = computed<MovementListItem[]>(() =>
  (query.data.value?.results ?? []).flatMap<MovementListItem>((o) => {
    const group = date(o.created_at);
    if (!o.entries.length)
      return [
        {
          key: o.id,
          description: o.description,
          value: null,
          direction: "neutral" as const,
          group,
          meta: group,
          valueLabel: "Sem lançamentos",
          to: `/operacoes/${o.id}`,
        },
      ];
    return o.entries.map((entry) => ({
      key: `${o.id}:${entry.id}`,
      description: entry.description || o.description,
      value: entry.value,
      direction: entry.direction,
      group,
      meta: [group, entry.category_label].filter(Boolean).join(" - "),
      to: `/operacoes/${o.id}`,
    }));
  }),
);
function close() {
  showForm.value = false;
  void router.replace({ query: {} });
}
</script>
<template>
  <header class="cash-header">
    <div>
      <h1><CashRegisterIcon :size="24" aria-hidden="true" />Caixa</h1>
      <p>Entradas, pagamentos e ajustes</p>
    </div>
    <div class="cash-actions">
      <button
        class="secondary filter-button"
        aria-label="Filtrar caixa"
        aria-haspopup="dialog"
        :aria-expanded="showFilters"
        @click="openFilters"
      >
        <Funnel :size="18" aria-hidden="true" /><span
          v-if="filterCount"
          class="filter-count"
          >{{ filterCount }}</span
        >
      </button>
      <button aria-label="Registrar operação" @click="showForm = true">
        <Plus :size="18" aria-hidden="true" />Novo
      </button>
    </div>
  </header>
  <QueryState
    :loading="summary.loading.value"
    :error="summary.error.value"
    @retry="summary.refresh"
  >
    <div
      v-if="summary.data.value"
      class="stat-grid cash-cards"
      aria-label="Resumo financeiro da loja"
    >
      <article class="stat" aria-label="Caixa da Loja">
        <div class="stat-top">
          Caixa da Loja<CashRegisterIcon :size="18" aria-hidden="true" />
        </div>
        <strong>{{ money(summary.data.value.cash_balance) }}</strong>
      </article>
      <article class="stat" aria-label="Despesas a pagar">
        <div class="stat-top">
          Despesas a pagar<Receipt :size="17" aria-hidden="true" />
        </div>
        <strong>{{ money(summary.data.value.unpaid_expenses_total) }}</strong>
      </article>
      <article class="stat" aria-label="Valores a Receber">
        <div class="stat-top">
          Valores a Receber<HandCoins :size="17" aria-hidden="true" />
        </div>
        <strong>{{
          money(summary.data.value.accounts_receivable_total)
        }}</strong>
      </article>
    </div>
  </QueryState>
  <section class="section cash-history" aria-label="Histórico do caixa">
    <div class="section-head cash-history-head">
      <div>
        <h2>Movimentações</h2>
        <p class="cash-date-context muted">Data de registro da operação</p>
      </div>
    </div>
    <QueryState
      :loading="query.loading.value"
      :error="query.error.value"
      :empty="!query.data.value?.results.length"
      @retry="query.refresh"
      ><div class="cash-movements"><MovementList :items="movementItems" /></div
    ></QueryState>
    <Pagination
      v-if="query.data.value"
      v-model:page="page"
      :total="query.data.value.total"
      :loading="query.loading.value"
    />
  </section>
  <Modal
    v-if="showFilters"
    :title="
      activePicker
        ? `Selecionar ${activePicker === 'member' ? 'membro' : 'período'}`
        : 'Filtrar caixa'
    "
    :class="['cash-filter-modal', { 'is-picking': activePicker }]"
    :style="{
      '--picker-height': `${Math.max(180, Math.min(560, viewportHeight - 24))}px`,
      '--picker-top': `${viewportTop + 12}px`,
      '--viewport-top': `${viewportTop}px`,
      '--viewport-height': `${viewportHeight}px`,
    }"
    @close="showFilters = false"
  >
    <form
      :class="['cash-filters', { 'is-picking': activePicker }]"
      @submit.prevent="applyFilters"
    >
      <div class="filter-fields">
        <label v-if="!activePicker"
          >Tipo<select aria-label="Tipo" v-model="draft.type">
            <option value="">Todas as operações</option>
            <option
              v-for="t in [
                'member_payment',
                'lodge_income',
                'adjustment',
                'opening_balance',
                'reversal',
                'expense',
                'period_close',
              ]"
              :value="t"
            >
              {{ label(t) }}
            </option>
          </select></label
        >
        <SearchSelect
          v-show="!activePicker || activePicker === 'member'"
          @editing="activePicker = $event ? 'member' : ''"
          v-model="draft.member"
          label="Membro"
          all-label="Todos os membros"
          :options="memberOptions"
          :loading="members.loading.value"
          :error="members.error.value"
          @retry="members.refresh"
        />
        <SearchSelect
          v-show="!activePicker || activePicker === 'period'"
          @editing="activePicker = $event ? 'period' : ''"
          v-model="draft.period"
          label="Período"
          all-label="Todos os períodos"
          :options="periodOptions"
          :loading="periods.loading.value"
          :error="periods.error.value"
          @retry="periods.refresh"
        />
      </div>

      <div v-if="!activePicker" class="filter-actions">
        <button
          type="button"
          class="secondary"
          @click="
            draft.type = '';
            draft.member = '';
            draft.period = '';
          "
        >
          Limpar filtros</button
        ><button type="submit">Aplicar filtros</button>
      </div>
    </form>
  </Modal>
  <OperationForm
    v-if="showForm"
    @close="close"
    @saved="
      close();
      query.refresh();
    "
  />
</template>

<style scoped>
.cash-filter-modal {
  box-sizing: border-box;
  width: calc(100% - 24px);
  max-width: 480px;
  padding: 16px;
  max-height: calc(var(--viewport-height, 100dvh) - 24px);
}
.cash-filter-modal :deep(.modal-head) {
  flex: 0 0 auto;
  min-width: 0;
  min-height: 44px;
  margin-bottom: 12px;
  gap: 8px;
}
.cash-filter-modal :deep(.modal-head h2) {
  font-size: 18px;
}
.cash-filter-modal.is-picking[open] {
  display: flex;
  flex-direction: column;
  height: var(--picker-height);
  max-height: var(--picker-height);
  top: var(--picker-top);
  bottom: auto;
  margin: 0 auto;
}
.cash-filters.is-picking,
.cash-filters.is-picking .filter-fields {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex-wrap: nowrap;
  flex: 1 1 0;
  width: 100%;
  min-width: 0;
  min-height: 0;
  margin: 0;
}
.cash-filters.is-picking .filter-fields {
  gap: 0;
}
@media (min-width: 768px) {
  .cash-filter-modal {
    padding: 20px;
  }
  .cash-filter-modal.is-picking[open] {
    top: calc(
      var(--viewport-top) + (var(--viewport-height) - var(--picker-height)) / 2
    );
  }
}

.cash-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.cash-header .filter-button {
  position: relative;
  width: 44px;
  padding: 0;
}
.filter-count {
  position: absolute;
  top: -5px;
  right: -5px;
  background: var(--navy);
  color: white;
  border: 1px solid var(--border);
  border-radius: 12px;
  min-width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  font-size: 11px;
}
.filter-actions {
  display: flex;
  gap: 8px;
  margin-top: 20px;
}
.filter-actions button {
  flex: 1;
  min-height: 44px;
}
.cash-header > div:first-child {
  min-width: 0;
}
@media (max-width: 350px) {
  .cash-header {
    gap: 8px;
  }
  .cash-header p {
    max-width: 155px;
  }
  .cash-header button {
    padding: 8px 10px;
  }
}

.cash-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.cash-header h1 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 24px;
  margin: 0;
}
.cash-header h1 svg {
  color: var(--gold);
}
.cash-header p {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--muted);
}
.cash-header button {
  min-height: 44px;
  padding: 8px 14px;
}
.cash-cards {
  gap: 8px;
  margin-bottom: 20px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.cash-cards .stat {
  padding: 14px 12px;
  min-width: 0;
  border-radius: 12px;
}
.cash-cards .stat:first-child {
  grid-column: 1/-1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.cash-cards .stat-top {
  font-size: 12px;
  gap: 6px;
  margin-bottom: 8px;
  line-height: 1.4;
}
.cash-cards .stat-top svg {
  flex-shrink: 0;
}
.cash-cards .stat:first-child .stat-top {
  margin-bottom: 0;
}
.cash-cards .stat strong {
  font-size: clamp(16px, 4.5vw, 23px);
  letter-spacing: -0.5px;
  margin: 0;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
.cash-cards .stat:first-child strong {
  font-size: 24px;
}
.cash-history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.cash-history-head h2 {
  font-size: 16px;
  margin: 0;
}
.cash-history-head span {
  font-size: 12px;
}
.cash-filters {
  margin: 4px 0 8px;
}
.cash-filters .filter-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  margin: 4px 0 12px;
}
.cash-filters label:first-child {
  grid-column: 1/-1;
}
.cash-filters label,
.cash-filters input,
.cash-filters select {
  min-width: 0;
  width: 100%;
}
.clear-filters {
  min-height: 44px;
  margin-bottom: 8px;
}
.cash-history {
  margin-top: 12px;
}
.cash-movements {
  padding: 12px 14px 0;
}
.cash-date-context {
  margin: 4px 0 0;
  font-size: 12px;
}
@media (min-width: 768px) {
  .cash-cards {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .cash-cards .stat:first-child {
    grid-column: auto;
    display: block;
  }
  .cash-cards .stat:first-child .stat-top {
    margin-bottom: 8px;
  }
  .cash-cards .stat {
    padding: 16px;
  }

  .cash-filters label:first-child {
    grid-column: auto;
  }
}
</style>
