<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Plus, ChevronRight, Download } from "@lucide/vue";
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
import QueryState from "@/components/QueryState.vue";
import Pagination from "@/components/Pagination.vue";
import ExpenseForm from "@/components/ExpenseForm.vue";
const route = useRoute(),
  router = useRouter();
const showForm = ref(route.query.novo === "1"),
  page = ref(1),
  paid = ref(""),
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
function clearFilters() {
  paid.value =
    status.value =
    category.value =
    type.value =
    from.value =
    to.value =
    member.value =
    period.value =
      "";
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
      <span class="muted">{{
        query.data.value ? `${query.data.value.total} registros` : "Carregando…"
      }}</span>
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
    <details class="expense-filters">
      <summary>
        Filtros <span v-if="filterCount" class="badge">{{ filterCount }}</span>
      </summary>
      <div class="expense-filter-grid">
        <label
          >Situação<select v-model="status">
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
          >Categoria<select v-model="category">
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
          >Tipo<select v-model="type">
            <option value="">Todos</option>
            <option v-for="t in types.data.value" :key="t.id" :value="t.id">
              {{ t.label }}
            </option>
          </select></label
        >
        <label>Data inicial<input v-model="from" type="date" /></label>
        <label>Data final<input v-model="to" type="date" :min="from" /></label>
        <label
          >ID do membro<input
            v-model.lazy="member"
            inputmode="numeric"
            placeholder="Todos"
        /></label>
        <label
          >ID do período<input
            v-model.lazy="period"
            inputmode="numeric"
            placeholder="Todos"
        /></label>
        <button class="secondary" @click="clearFilters">Limpar filtros</button>
      </div>
    </details>
  </fieldset>
  <section class="section expense-list" aria-label="Despesas registradas">
    <QueryState
      :loading="query.loading.value"
      :error="query.error.value"
      :empty="!query.data.value?.results.length"
      @retry="query.refresh"
    >
      <RouterLink
        v-for="e in query.data.value?.results"
        :key="e.id"
        :to="`/despesas/${e.id}`"
        class="expense-item"
      >
        <div class="expense-description">
          <strong>{{ e.label }}</strong>
          <div class="expense-meta">
            <span class="badge">{{
              expenseTypeLabel(e.expense_type_slug)
            }}</span
            ><span class="expense-category">{{
              categoryNames[e.expense_category_id] || e.expense_category_slug
            }}</span>
          </div>
          <small
            >{{ e.parcels }} {{ e.parcels === 1 ? "parcela" : "parcelas"
            }}<template v-if="e.status === 'partially_cancelled'">
              · Cancelada parcialmente</template
            ></small
          >
        </div>
        <div class="expense-amount">
          <small>Valor original</small
          ><strong>{{ money(e.total_value) }}</strong
          ><span
            :class="['badge', { success: e.payed && e.status !== 'cancelled' }]"
            >{{ expensePaymentLabel(e) }}</span
          >
        </div>
        <ChevronRight :size="15" aria-hidden="true" />
      </RouterLink>
    </QueryState>
    <Pagination
      v-if="query.data.value"
      v-model:page="page"
      :total="query.data.value.total"
    />
  </section>
  <ExpenseForm
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
  background: var(--navy, #011733);
  color: white;
  border-color: var(--navy, #011733);
}
.expense-filters {
  margin-top: 8px;
}
.expense-filters summary {
  cursor: pointer;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 13px;
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
.expense-list {
  overflow: hidden;
}
.expense-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 15px;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid var(--border);
}
.expense-item:last-of-type {
  border-bottom: 0;
}
.expense-description {
  min-width: 0;
}
.expense-description > strong {
  display: block;
  overflow-wrap: anywhere;
  font-size: 14px;
  line-height: 1.4;
}
.expense-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin: 5px 0;
}
.expense-category {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--muted);
}
.expense-description small,
.expense-amount small {
  font-size: 12px;
  color: var(--muted);
}
.expense-amount {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.expense-amount strong {
  font-size: 14px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.expense-meta .badge,
.expense-amount .badge {
  font-size: 12px;
  padding: 2px 6px;
}
.export-feedback {
  font-size: 12px;
  margin: 8px 0;
}
.expense-item:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: -3px;
}
@media (min-width: 768px) {
  .expense-filter-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .payment-tabs {
    max-width: 360px;
  }
  .expense-item {
    padding: 14px 20px;
  }
}
@media (max-width: 350px) {
  .expense-item {
    padding: 12px 10px;
    gap: 6px;
  }
  .expense-amount strong {
    font-size: 12px;
  }
  .expenses-actions button {
    padding: 0 9px;
  }
}
</style>
