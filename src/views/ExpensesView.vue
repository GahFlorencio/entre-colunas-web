<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Plus, Receipt, Download, ListFilter } from "@lucide/vue";
import { token, lodgeId, lodge } from "@/lib/session";
import { money } from "@/lib/format";
import { useQuery } from "@/lib/query";
import { writeVersion } from "@/lib/financial-write";
import { listExpenses, listExpenseTypes } from "@/domain/expenses/api";
import {
  readAllExpenses,
  readExpenseCategories,
  expenseTypeLabel,
  expenseStatusLabel,
  expensePaymentLabel,
} from "@/domain/expenses/report";
import type { ExpenseFilters } from "@/domain/expenses/types";
import Modal from "@/components/Modal.vue";
import SearchSelect from "@/components/SearchSelect.vue";
import { allEligibleMembers, collectPages } from "@/lib/catalogs";
import { date } from "@/lib/format";
import { listFinancialPeriods } from "@/domain/expenses/api";
import type { LodgeFinancialSummary } from "@/domain/lodge-financial/summary-state";
import MovementList from "@/components/MovementList.vue";
import { readLodgeFinancialSummary } from "@/domain/lodge-financial/summary-source";
import QueryState from "@/components/QueryState.vue";
import Pagination from "@/components/Pagination.vue";
import ExpenseForm from "@/components/ExpenseForm.vue";
const route = useRoute(),
  router = useRouter();
const showForm = ref(route.query.novo === "1"),
  page = ref(1),
  paid = ref(route.query.pagamento === "pendente" ? "false" : ""),
  status = ref(""),
  category = ref(""),
  type = ref(""),
  from = ref(""),
  to = ref(""),
  member = ref(""),
  period = ref("");
const exporting = ref(false),
  exportError = ref(""),
  progress = ref("");
let alive = true;
onScopeDispose(() => {
  alive = false;
});
const invalidDates = computed(
  () => !!(from.value && to.value && from.value > to.value),
);
const filters = computed<ExpenseFilters>(() => ({
  payed: paid.value === "" ? undefined : paid.value === "true",
  expense_status: status.value || undefined,
  expense_category_id: category.value || undefined,
  expense_type_id: type.value || undefined,
  member_id: member.value || undefined,
  financial_period_id: period.value || undefined,
  from: from.value
    ? new Date(`${from.value}T00:00:00`).toISOString()
    : undefined,
  to: to.value ? new Date(`${to.value}T23:59:59.999`).toISOString() : undefined,
}));
watch(filters, () => {
  page.value = 1;
  exportError.value = "";
});
const query = useQuery(
  () => {
    if (invalidDates.value)
      throw new Error("A data final deve ser igual ou posterior à inicial.");
    return listExpenses(token.value, lodgeId.value, {
      page: page.value,
      perPage: 20,
      filters: filters.value,
    });
  },
  () => [page.value, filters.value],
);
const summary = useQuery(
  async () =>
    (await readLodgeFinancialSummary(
      token.value,
      lodgeId.value,
    )) as LodgeFinancialSummary,
);
const movementItems = computed(() =>
  (query.data.value?.results ?? []).map((e) => ({
    key: e.id,
    description: e.label,
    value: e.total_value,
    direction: "debit" as const,
    group: "",
    meta: [
      expenseTypeLabel(e.expense_type_slug),
      categoryNames.value[e.expense_category_id] || e.expense_category_slug,
      `${e.parcels} ${e.parcels === 1 ? "parcela" : "parcelas"}`,
      e.status === "partially_cancelled" ? "Cancelada parcialmente" : "",
      expensePaymentLabel(e),
    ]
      .filter(Boolean)
      .join(" · "),
    valueLabel: "Valor original",
    unsigned: true,
    to: `/despesas/${e.id}`,
  })),
);
const categories = useQuery(() =>
  readExpenseCategories(token.value, lodgeId.value),
);
const types = useQuery(() => listExpenseTypes(token.value, lodgeId.value));
const categoryNames = computed(() =>
  Object.fromEntries((categories.data.value || []).map((c) => [c.id, c.label])),
);
const filterCount = computed(
  () =>
    [
      status.value,
      category.value,
      type.value,
      from.value,
      to.value,
      member.value,
      period.value,
    ].filter(Boolean).length,
);
const showFilters = ref(false),
  selecting = ref(false);
const emptyDraft = () => ({
  status: "",
  category: "",
  type: "",
  from: "",
  to: "",
  member: "",
  period: "",
});
const draft = ref(emptyDraft());
const draftInvalidDates = computed(
  () =>
    !!(draft.value.from && draft.value.to && draft.value.from > draft.value.to),
);
const members = useQuery(() => allEligibleMembers(token.value, lodgeId.value));
const periods = useQuery(() =>
  collectPages((page) =>
    listFinancialPeriods(token.value, lodgeId.value, { page, perPage: 100 }),
  ),
);
function openFilters() {
  draft.value = {
    status: status.value,
    category: category.value,
    type: type.value,
    from: from.value,
    to: to.value,
    member: member.value,
    period: period.value,
  };
  selecting.value = false;
  showFilters.value = true;
}
function applyFilters() {
  if (draftInvalidDates.value || selecting.value) return;
  status.value = draft.value.status;
  category.value = draft.value.category;
  type.value = draft.value.type;
  from.value = draft.value.from;
  to.value = draft.value.to;
  member.value = draft.value.member;
  period.value = draft.value.period;
  showFilters.value = false;
}
function close() {
  showForm.value = false;
  void router.replace({ query: {} });
}
async function exportPdf() {
  if (exporting.value || invalidDates.value) return;
  exporting.value = true;
  exportError.value = "";
  progress.value = "Preparando…";
  const context = {
    token: token.value,
    lodge: lodgeId.value,
    version: writeVersion.value,
    filters: JSON.stringify(filters.value),
  };
  const assertCurrent = () => {
    if (
      !alive ||
      context.token !== token.value ||
      context.lodge !== lodgeId.value ||
      context.version !== writeVersion.value ||
      context.filters !== JSON.stringify(filters.value)
    )
      throw new Error("Os dados mudaram. Exporte novamente.");
  };
  try {
    const selected = { ...filters.value };
    const labels = [
      paid.value && (paid.value === "true" ? "Pagas" : "A pagar"),
      status.value && expenseStatusLabel(status.value),
      category.value &&
        (categoryNames.value[category.value] || `Categoria #${category.value}`),
      type.value &&
        (types.data.value?.find((t) => t.id === type.value)?.label ||
          `Tipo #${type.value}`),
      from.value && `De ${from.value.split("-").reverse().join("/")}`,
      to.value && `Até ${to.value.split("-").reverse().join("/")}`,
      member.value && `Membro #${member.value}`,
      period.value && `Período #${period.value}`,
    ].filter(Boolean) as string[];
    const [expenses, allCategories] = await Promise.all([
      readAllExpenses(context.token, context.lodge, selected, {
        assertCurrent,
        onProgress: (done, total) => {
          progress.value = `${done} de ${total}`;
        },
      }),
      readExpenseCategories(context.token, context.lodge),
    ]);
    const { downloadExpensesPdf } =
      await import("@/domain/expenses/report-pdf");
    assertCurrent();
    downloadExpensesPdf({
      lodgeName: lodge.value?.label || "Loja",
      generatedAt: new Date().toISOString(),
      filters: labels,
      expenses,
      categories: Object.fromEntries(allCategories.map((c) => [c.id, c.label])),
    });
  } catch (error) {
    if (alive)
      exportError.value =
        error instanceof Error
          ? error.message
          : "Não foi possível exportar. Tente novamente.";
  } finally {
    exporting.value = false;
    progress.value = "";
  }
}
</script>
<template>
  <header class="expenses-header">
    <div>
      <h1>Despesas</h1>
    </div>
    <div class="expenses-actions">
      <button
        class="secondary"
        :disabled="
          exporting || query.loading.value || !query.data.value || invalidDates
        "
        aria-label="Exportar despesas em PDF"
        @click="exportPdf"
      >
        <Download :size="17" aria-hidden="true" />PDF
      </button>
      <button
        :disabled="exporting"
        aria-label="Registrar despesa"
        @click="showForm = true"
      >
        <Plus :size="18" aria-hidden="true" />Nova
      </button>
    </div>
  </header>
  <p v-if="exporting" class="muted export-feedback" role="status">
    Exportando · {{ progress }}
  </p>
  <p v-if="exportError" class="error export-feedback" role="alert">
    {{ exportError }}
  </p>
  <QueryState
    :loading="summary.loading.value"
    :error="summary.error.value"
    @retry="summary.refresh"
  >
    <article v-if="summary.data.value" class="stat expense-total">
      <div class="stat-top">
        A pagar <Receipt :size="20" aria-hidden="true" />
      </div>
      <strong>{{ money(summary.data.value.unpaid_expenses_total) }}</strong>
      <small>Total da loja · despesas ainda não pagas</small>
    </article>
  </QueryState>
  <fieldset class="expense-filter-controls" :disabled="exporting">
    <legend class="sr-only">Filtros de despesas</legend>
    <div class="payment-tabs" role="group" aria-label="Pagamento">
      <button
        v-for="option in [
          { value: '', label: 'Todas' },
          { value: 'false', label: 'A pagar' },
          { value: 'true', label: 'Pagas' },
        ]"
        :key="option.value"
        class="secondary"
        :aria-pressed="paid === option.value"
        @click="paid = option.value"
      >
        {{ option.label }}
      </button>
    </div>
  </fieldset>
  <section class="section expense-list" aria-label="Despesas registradas">
    <div class="section-head">
      <h2>Despesas</h2>
      <button class="secondary" :disabled="exporting" @click="openFilters">
        <ListFilter :size="18" aria-hidden="true" />Filtros
        <span v-if="filterCount">{{ filterCount }}</span>
      </button>
    </div>
    <p class="expense-payment-note">
      “Pagas” e “A pagar” são indicadores administrativos; marcar uma despesa
      como paga atualiza o caixa administrativo, sem criar movimento no extrato
      contábil.
    </p>
    <QueryState
      :loading="query.loading.value"
      :error="query.error.value"
      :empty="!query.data.value?.results.length"
      @retry="query.refresh"
    >
      <div class="expense-movements expense-mobile-list">
        <MovementList :items="movementItems" :show-dates="false" />
      </div>
      <div class="expense-table-wrap" aria-label="Tabela de despesas">
        <table class="expense-table">
          <thead>
            <tr>
              <th scope="col">Despesa</th>
              <th scope="col">Tipo</th>
              <th scope="col">Programação</th>
              <th scope="col">Situação</th>
              <th scope="col">Pagamento</th>
              <th scope="col" class="expense-value-heading">Valor original</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="expense in query.data.value?.results" :key="expense.id">
              <td>
                <RouterLink
                  class="expense-name"
                  :to="`/despesas/${expense.id}`"
                >
                  {{ expense.label }}
                </RouterLink>
                <small>{{
                  categoryNames[expense.expense_category_id] ||
                  expense.expense_category_slug
                }}</small>
              </td>
              <td>{{ expenseTypeLabel(expense.expense_type_slug) }}</td>
              <td>
                {{ expense.parcels }}
                {{ expense.parcels === 1 ? "parcela" : "parcelas" }}
              </td>
              <td>{{ expenseStatusLabel(expense.status) }}</td>
              <td>{{ expensePaymentLabel(expense) }}</td>
              <td class="expense-value">{{ money(expense.total_value) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </QueryState>
    <p v-if="query.data.value" class="expense-count muted">
      {{ query.data.value.total }} registros
    </p>
    <Pagination
      v-if="query.data.value"
      v-model:page="page"
      :total="query.data.value.total"
    />
  </section>
  <Modal
    v-if="showFilters"
    title="Filtros de despesas"
    class="expense-filter-modal"
    @close="showFilters = false"
  >
    <form
      class="expense-filter-form"
      @submit.prevent="applyFilters"
      @keydown.enter="selecting && $event.preventDefault()"
    >
      <div :class="['expense-filter-grid', { selecting }]">
        <label
          >Situação<select v-model="draft.status" aria-label="Situação">
            <option value="">Todas</option>
            <option
              v-for="s in ['active', 'partially_cancelled', 'cancelled']"
              :key="s"
              :value="s"
            >
              {{ expenseStatusLabel(s) }}
            </option>
          </select></label
        >
        <label
          >Categoria<select v-model="draft.category">
            <option value="">Todas</option>
            <option
              v-for="c in categories.data.value"
              :key="c.id"
              :value="c.id"
            >
              {{ c.label }}
            </option>
          </select></label
        >
        <label
          >Tipo<select v-model="draft.type">
            <option value="">Todos</option>
            <option v-for="t in types.data.value" :key="t.id" :value="t.id">
              {{ t.label }}
            </option>
          </select></label
        >
        <label>Data inicial<input v-model="draft.from" type="date" /></label>
        <label
          >Data final<input v-model="draft.to" type="date" :min="draft.from"
        /></label>
        <SearchSelect
          v-model="draft.member"
          label="Membro"
          all-label="Todos"
          :options="
            (members.data.value?.results ?? []).map((m) => ({
              value: m.id,
              label: m.name,
              detail: m.status.label,
            }))
          "
          :loading="members.loading.value"
          :error="members.error.value"
          @retry="members.refresh"
          @editing="selecting = $event"
        />
        <SearchSelect
          v-model="draft.period"
          label="Período"
          all-label="Todos"
          :options="
            (periods.data.value?.results ?? []).map((p) => ({
              value: p.id,
              label: `Período ${p.sequence}`,
              detail: `${p.status === 'open' ? 'Aberto' : 'Fechado'} · ${date(p.opened_at)}`,
            }))
          "
          :loading="periods.loading.value"
          :error="periods.error.value"
          @retry="periods.refresh"
          @editing="selecting = $event"
        />
      </div>

      <p v-if="draftInvalidDates && !selecting" class="error" role="alert">
        A data final deve ser igual ou posterior à inicial.
      </p>
      <div v-if="!selecting" class="filter-actions">
        <button type="button" class="secondary" @click="draft = emptyDraft()">
          Limpar filtros
        </button>
        <button type="button" class="secondary" @click="showFilters = false">
          Cancelar
        </button>
        <button :disabled="draftInvalidDates">Aplicar filtros</button>
      </div>
    </form>
  </Modal>
  <ExpenseForm v-if="showForm" @close="close" @saved="close" />
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
  border: 0;
}

.expenses-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.expenses-header h1 {
  margin: 0;
  font-size: 24px;
}
.expenses-header .muted {
  font-size: 12px;
}
.expenses-actions {
  display: flex;
  gap: 6px;
}
.expenses-actions button {
  min-height: 44px;
  padding: 0 12px;
}
.expense-filter-controls {
  border: 0;
  padding: 0;
  margin: 0 0 12px;
  min-width: 0;
}
.payment-tabs {
  display: flex;
  gap: 4px;
}
.payment-tabs button {
  flex: 1;
  min-height: 44px;
  padding: 8px;
}
.payment-tabs button[aria-pressed="true"] {
  background: var(--primary);
  color: var(--on-primary);
  border-color: var(--primary);
}
.expense-filter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 8px 0;
}
.expense-filter-grid label {
  min-width: 0;
}
.expense-filter-grid input,
.expense-filter-grid select {
  width: 100%;
  min-width: 0;
}
.expense-total {
  margin-bottom: 16px;
  min-width: 0;
}
.expense-total strong {
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.expense-movements {
  padding: 0 16px;
}
.expense-table-wrap {
  display: none;
}
.expense-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 13px;
}
.expense-table th,
.expense-table td {
  padding: 13px 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: middle;
  overflow-wrap: anywhere;
}
.expense-table th {
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.expense-table th:first-child,
.expense-table td:first-child {
  width: 34%;
  padding-left: 16px;
}
.expense-table th:nth-child(2) {
  width: 13%;
}
.expense-table th:nth-child(3) {
  width: 13%;
}
.expense-table th:nth-child(4) {
  width: 14%;
}
.expense-table th:nth-child(5) {
  width: 14%;
}
.expense-table .expense-value-heading,
.expense-table .expense-value {
  width: 16%;
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.expense-name {
  display: block;
  width: fit-content;
  max-width: 100%;
  color: var(--text);
  font-weight: 600;
  line-height: 1.4;
  text-decoration: none;
}
.expense-name:hover {
  color: var(--gold);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.expense-name:focus-visible {
  outline: 2px solid var(--focus, var(--gold));
  outline-offset: 3px;
  border-radius: 2px;
}
.expense-table td:first-child small {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 11px;
}
.expense-count {
  padding: 12px 16px 0;
  margin: 0;
  font-size: 12px;
}
.export-feedback {
  font-size: 12px;
  margin: 8px 0;
}
.expense-payment-note {
  margin: 0;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}
@media (min-width: 768px) {
  .expense-filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .payment-tabs {
    max-width: 360px;
  }
}
@media (min-width: 1280px) {
  .expense-mobile-list {
    display: none;
  }
  .expense-table-wrap {
    display: block;
  }
}
@media (max-width: 350px) {
  .expenses-actions button {
    padding: 0 9px;
  }
}
.expense-filter-modal {
  width: min(480px, calc(100% - 24px));
  max-width: calc(100% - 24px);
  box-sizing: border-box;
}
.expense-filter-form {
  min-width: 0;
}
.filter-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.filter-actions button {
  min-height: 44px;
  flex: 1;
}
.expense-filter-form:has(.selecting) {
  display: flex;
  flex-direction: column;
  height: min(560px, 65dvh);
  min-height: 0;
}
.expense-filter-grid.selecting {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  align-items: stretch;
}
.expense-filter-grid.selecting > :not(.is-open) {
  display: none;
}
</style>
