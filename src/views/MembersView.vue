<script setup lang="ts">
import { ref, computed, reactive, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Plus, ChevronRight, Funnel, Users, Phone } from "@lucide/vue";
import { token, lodgeId } from "@/lib/session";
import { phone, money } from "@/lib/format";
import { collectPages } from "@/lib/catalogs";
import { listMembers, listMemberStatuses } from "@/domain/members/api";
import { useQuery } from "@/lib/query";
import QueryState from "@/components/QueryState.vue";
import Pagination from "@/components/Pagination.vue";
import MemberForm from "@/components/MemberForm.vue";
import Modal from "@/components/Modal.vue";
import PaymentRecency from "@/components/PaymentRecency.vue";
import { usePaymentRecency } from "@/domain/members/payment-recency";
import { getMemberAccountSummaries } from "@/domain/member-account/api";
const route = useRoute(),
  router = useRouter();
const page = ref(1),
  status = ref(""),
  search = ref("");
const showForm = ref(route.query.novo === "1"),
  showFilters = ref(false);
const draft = reactive({ search: "", status: "" });
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
const source = useQuery(
  async () => {
    const sessionToken = token.value,
      selectedLodge = lodgeId.value;
    const options = {
      perPage: 20,
      statuses: status.value ? [status.value] : undefined,
    };
    const term = normalize(search.value.trim());
    if (!term)
      return listMembers(sessionToken, selectedLodge, {
        ...options,
        page: page.value,
      });
    const all = await collectPages((p) =>
      listMembers(sessionToken, selectedLodge, {
        ...options,
        perPage: 100,
        page: p,
      }),
    );
    const results = all.results.filter((m) => normalize(m.name).includes(term));
    return {
      results,
      total: results.length,
      page: 1,
      per_page: 20,
    };
  },
  // A name search collects all pages once; paging its results is local.
  () => [search.value.trim() ? null : page.value, status.value, search.value],
);
const query = {
  ...source,
  data: computed(() => {
    const data = source.data.value;
    if (!data || !search.value.trim()) return data;
    return {
      ...data,
      results: data.results.slice((page.value - 1) * 20, page.value * 20),
      page: page.value,
    };
  }),
};
const visibleIds = computed(
  () => query.data.value?.results.map((m) => m.id) ?? [],
);
const recency = usePaymentRecency(() => visibleIds.value);
const accounts = useQuery(
  () =>
    visibleIds.value.length
      ? getMemberAccountSummaries(token.value, lodgeId.value, visibleIds.value)
      : Promise.resolve([]),
  () => visibleIds.value,
);
const balances = computed(
  () => new Map(accounts.data.value?.map((item) => [item.member_id, item])),
);
const statuses = useQuery(() => listMemberStatuses(token.value));
const filterCount = computed(
  () => Number(!!search.value) + Number(!!status.value),
);
const statusLabel = computed(
  () =>
    statuses.data.value?.find((s) => s.slug === status.value)?.label ||
    status.value,
);
const filterButton = ref<HTMLButtonElement>();
async function closeFilters() {
  showFilters.value = false;
  await nextTick();
  filterButton.value?.focus();
}
function openFilters() {
  Object.assign(draft, { search: search.value, status: status.value });
  showFilters.value = true;
}
function applyFilters() {
  page.value = 1;
  search.value = draft.search.trim();
  status.value = draft.status;
  void closeFilters();
}
function close() {
  showForm.value = false;
  const { novo, ...query } = route.query;
  void router.replace({ query });
}
</script>
<template>
  <header class="members-header">
    <h1><Users :size="24" aria-hidden="true" />Membros</h1>
    <div class="members-actions">
      <button
        class="secondary"
        ref="filterButton"
        aria-label="Filtrar membros"
        aria-haspopup="dialog"
        :aria-expanded="showFilters"
        @click="openFilters"
      >
        <Funnel :size="18" aria-hidden="true" /><span v-if="filterCount">{{
          filterCount
        }}</span>
      </button>
      <button aria-label="Cadastrar membro" @click="showForm = true">
        <Plus :size="18" aria-hidden="true" />Novo
      </button>
    </div>
  </header>
  <label class="member-search"
    >Buscar membro<input
      v-model="search"
      type="search"
      placeholder="Nome do membro"
      @input="page = 1"
  /></label>
  <div
    v-if="filterCount"
    class="members-applied"
    aria-label="Filtros aplicados"
  >
    <span v-if="search">Nome: {{ search }}</span
    ><span v-if="status">Situação: {{ statusLabel }}</span>
  </div>
  <section class="section members-list" aria-label="Lista de membros">
    <div class="members-list-head">
      <h2 class="sr-only">Lista de membros</h2>
      <span v-if="query.data.value" class="muted" role="status"
        >{{ query.data.value.total }}
        {{ filterCount ? "encontrados" : "cadastrados" }}</span
      >
    </div>
    <QueryState
      :loading="query.loading.value"
      :error="query.error.value"
      @retry="query.refresh"
    >
      <div v-if="!query.data.value?.results.length" class="state">
        <strong>{{
          filterCount ? "Nenhum membro encontrado" : "Nenhum membro cadastrado"
        }}</strong>
        <p>
          {{
            filterCount
              ? "Revise o nome ou a situação nos filtros."
              : "Cadastre o primeiro membro da loja."
          }}
        </p>
        <button
          class="secondary"
          @click="filterCount ? openFilters() : (showForm = true)"
        >
          {{ filterCount ? "Revisar filtros" : "Cadastrar membro" }}
        </button>
      </div>
      <div
        v-if="accounts.error.value || recency.error.value"
        class="members-data-error"
        role="alert"
      >
        <span>{{
          accounts.error.value
            ? "Saldos indisponíveis."
            : "Indicadores de pagamento indisponíveis."
        }}</span>
        <button
          class="text-button"
          @click="
            accounts.error.value && accounts.refresh();
            recency.error.value && recency.refresh();
          "
        >
          Tentar novamente
        </button>
      </div>
      <div
        v-if="query.data.value?.results.length"
        class="member-columns"
        aria-hidden="true"
      >
        <span>Membro</span><span>Posição financeira</span
        ><span>Referência de pagamento</span><span></span>
      </div>
      <RouterLink
        v-for="m in query.data.value?.results"
        :key="m.id"
        :to="`/membros/${m.id}`"
        class="member-row"
      >
        <div class="member-info">
          <span class="row-title">{{ m.name }}</span>
          <div class="member-meta">
            <span class="member-phone"
              ><Phone :size="13" aria-hidden="true" />{{ phone(m.phone) }}</span
            >
            <span
              :class="['member-status', { active: m.status.slug === 'ativo' }]"
              >{{ m.status.label }}</span
            >
            <span>Ágape: {{ m.agape_participant ? "Sim" : "Não" }}</span>
          </div>
        </div>
        <div class="member-amount member-current">
          <span class="amount-label">{{
            balances.has(m.id)
              ? balances.get(m.id)!.balance > 0
                ? "Crédito"
                : balances.get(m.id)!.payable > 0
                  ? "A pagar"
                  : "Sem saldo a pagar"
              : "Posição financeira"
          }}</span>
          <strong
            v-if="balances.has(m.id)"
            :class="
              balances.get(m.id)!.balance < 0 ? 'amount-debt' : 'amount-credit'
            "
            >{{
              money(
                balances.get(m.id)!.balance > 0
                  ? balances.get(m.id)!.balance
                  : balances.get(m.id)!.payable,
              )
            }}</strong
          >
          <span v-else class="amount-state">{{
            accounts.loading.value ? "Carregando…" : "Indisponível"
          }}</span>
        </div>
        <div class="member-recency">
          <PaymentRecency
            compact
            :value="recency.byMember.value.get(m.id)"
            :loading="recency.loading.value"
          />
        </div>
        <ChevronRight :size="16" aria-hidden="true" class="member-chevron" />
      </RouterLink>
    </QueryState>
    <Pagination
      v-if="query.data.value && query.data.value.total > 20"
      v-model:page="page"
      :total="query.data.value.total"
      :loading="query.loading.value"
    />
  </section>
  <Modal
    v-if="showFilters"
    title="Filtrar membros"
    class="members-filter-modal"
    @close="closeFilters"
  >
    <form class="members-filters" @submit.prevent="applyFilters">
      <label
        >Nome<input
          v-model="draft.search"
          type="search"
          placeholder="Buscar em todos os membros"
      /></label>
      <label
        >Situação<select
          v-model="draft.status"
          :disabled="statuses.loading.value || !!statuses.error.value"
        >
          <option value="">
            {{
              statuses.loading.value
                ? "Carregando situações…"
                : "Todas as situações"
            }}
          </option>
          <option
            v-for="s in statuses.data.value || []"
            :key="s.id"
            :value="s.slug"
          >
            {{ s.label }}
          </option>
        </select></label
      >
      <div v-if="statuses.error.value" role="alert">
        <p>{{ statuses.error.value }}</p>
        <button type="button" class="secondary" @click="statuses.refresh">
          Tentar novamente
        </button>
      </div>
      <div class="members-filter-actions">
        <button
          type="button"
          class="secondary"
          @click="
            draft.search = '';
            draft.status = '';
          "
        >
          Limpar filtros</button
        ><button type="submit">Aplicar filtros</button>
      </div>
    </form>
  </Modal>
  <MemberForm
    v-if="showForm"
    @close="close"
    @saved="
      close();
      query.refresh();
    "
  />
</template>
<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.members-header,
.members-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.members-header {
  justify-content: space-between;
  margin-bottom: 16px;
}
.members-header h1 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 24px;
}
.members-header h1 svg {
  color: var(--gold);
}
.members-actions {
  flex-shrink: 0;
}
.members-actions button {
  min-height: 44px;
  min-width: 44px;
  padding: 8px 12px;
}
.members-list-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  padding: 16px;
  border-bottom: 1px solid var(--border);
  align-items: center;
}
.members-list-head h2 {
  margin: 0;
  font-size: 16px;
}
.members-list-head > span {
  font-size: 12px;
}
.member-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 16px;
  grid-template-areas: "identity chevron" "balance balance" "recency recency";
  align-items: center;
  gap: 8px 12px;
  padding: 18px 16px;
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid var(--border);
  transition: background-color 0.15s;
}
.member-row:last-child {
  border-bottom: 0;
}
.member-row:hover {
  background: var(--bg);
}
.member-row:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: -3px;
}
.member-info {
  grid-area: identity;
  min-width: 0;
  overflow-wrap: anywhere;
  margin-bottom: 4px;
}
.member-info .row-title {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
}
.member-phone {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}
.member-phone svg {
  flex-shrink: 0;
}
.member-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin-top: 8px;
  color: var(--muted);
  font-size: 12px;
}
.member-status {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 12px;
  line-height: 1.5;
  max-width: 100%;
}
.member-status.active {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 6%, transparent);
  border-color: color-mix(in srgb, var(--success) 20%, transparent);
}
.member-current {
  grid-area: balance;
}
.member-payable {
  grid-area: payable;
}
.member-amount {
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.amount-label,
.amount-state {
  font-size: 12px;
  color: var(--muted);
}
.member-amount strong {
  min-width: 0;
  font-size: 15px;
  line-height: 1.5;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
  text-align: right;
}
.amount-credit {
  color: var(--success);
}
.amount-debt {
  color: var(--danger);
}
.member-recency {
  grid-area: recency;
  min-width: 0;
  margin-top: 4px;
}
.member-chevron {
  grid-area: chevron;
  color: var(--muted);
}
.member-columns {
  display: none;
}
.members-data-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  color: var(--danger);
}
.members-data-error button {
  min-height: 44px;
}
@media (min-width: 600px) {
  .member-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 16px;
    grid-template-areas: "identity recency chevron" "balance balance chevron";
    gap: 14px 24px;
  }
  .member-recency {
    justify-self: end;
  }
}
@media (min-width: 1024px) {
  .member-row,
  .member-columns {
    grid-template-columns:
      minmax(0, 2fr) minmax(0, 1.3fr)
      minmax(0, 1.5fr) 16px;
    gap: 20px;
  }
  .member-row {
    grid-template-areas: "identity balance recency chevron";
  }
  .member-columns {
    display: grid;
    padding: 12px 24px;
    border-bottom: 1px solid var(--border);
    color: var(--muted);
    font-size: 12px;
    background: var(--bg);
  }
  .member-columns span:nth-child(2),
  .member-columns span:nth-child(3) {
    text-align: right;
  }
  .member-info {
    margin-bottom: 0;
  }
  .member-amount {
    justify-content: flex-end;
  }
  .member-recency {
    justify-self: start;
    margin-top: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .member-row {
    transition: none;
  }
}
.members-applied {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--muted);
  overflow-wrap: anywhere;
}
.members-applied span {
  max-width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
}
.members-filter-modal {
  box-sizing: border-box;
  width: calc(100% - 24px);
  max-width: 480px;
  max-height: calc(100dvh - 24px);
  padding: 16px;
}
.members-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}
.members-filters label,
.members-filters input,
.members-filters select {
  min-width: 0;
  width: 100%;
}
.members-filters input,
.members-filters select {
  font-size: 16px;
  min-height: 44px;
}
.members-filter-actions {
  display: flex;
  gap: 8px;
}
.members-filter-actions button {
  flex: 1;
  min-height: 44px;
  padding: 10px;
}
@media (min-width: 768px) {
  .member-row {
    padding: 16px 24px;
  }
  .members-list-head {
    padding: 16px 24px;
  }
  .members-filter-modal {
    padding: 24px;
  }
}
@media (max-width: 350px) {
  .members-header h1 {
    font-size: 22px;
    gap: 6px;
  }
  .members-header h1 svg {
    display: none;
  }
}
.member-search {
  margin-bottom: 16px;
  font-size: 13px;
}
@media (min-width: 1024px) {
  .member-search {
    max-width: 420px;
  }
  .member-row {
    padding-block: 14px;
  }
}
</style>
