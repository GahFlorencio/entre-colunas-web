<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Plus, ChevronRight } from "@lucide/vue";
import { token, lodgeId } from "@/lib/session";
import { money, label } from "@/lib/format";
import { useQuery } from "@/lib/query";
import {
  listExpenses,
  listExpenseCategories,
  listExpenseTypes,
} from "@/domain/expenses/api";
import QueryState from "@/components/QueryState.vue";
import Pagination from "@/components/Pagination.vue";
import ExpenseForm from "@/components/ExpenseForm.vue";
const route = useRoute(),
  router = useRouter(),
  showForm = ref(route.query.novo === "1"),
  page = ref(1),
  paid = ref(""),
  status = ref(""),
  category = ref(""),
  type = ref(""),
  from = ref(""),
  to = ref(""),
  member = ref(""),
  period = ref("");
const query = useQuery(
  () =>
    listExpenses(token.value, lodgeId.value, {
      page: page.value,
      perPage: 20,
      filters: {
        payed: paid.value === "" ? undefined : paid.value === "true",
        expense_status: status.value || undefined,
        expense_category_id: category.value || undefined,
        expense_type_id: type.value || undefined,
        from: from.value || undefined,
        to: to.value || undefined,
        member_id: member.value || undefined,
        financial_period_id: period.value || undefined,
      },
    }),
  () => [
    page.value,
    paid.value,
    status.value,
    category.value,
    type.value,
    from.value,
    to.value,
    member.value,
    period.value,
  ],
);
const categories = useQuery(() =>
  listExpenseCategories(token.value, lodgeId.value, "all", {
    page: 1,
    perPage: 100,
  }),
);
const types = useQuery(() => listExpenseTypes(token.value, lodgeId.value));
function close() {
  showForm.value = false;
  void router.replace({ query: {} });
}
</script>
<template>
  <div class="page-header">
    <div>
      <p class="eyebrow">CONTROLE FINANCEIRO</p>
      <h1>Despesas</h1>
      <p>Os compromissos da loja, organizados.</p>
    </div>
    <button @click="showForm = true">
      <Plus aria-hidden="true" :size="18" />Registrar despesa
    </button>
  </div>
  <div class="toolbar">
    <label
      >Pagamento<select v-model="paid" @change="page = 1">
        <option value="">Todas</option>
        <option value="false">A pagar</option>
        <option value="true">Pagas</option>
      </select></label
    ><label
      >Situação<select v-model="status" @change="page = 1">
        <option value="">Todas</option>
        <option
          v-for="s in ['active', 'partially_cancelled', 'cancelled']"
          :value="s"
        >
          {{ label(s) }}
        </option>
      </select></label
    ><label
      >Categoria<select v-model="category" @change="page = 1">
        <option value="">Todas</option>
        <option
          v-for="c in categories.data.value?.results"
          :key="c.id"
          :value="c.id"
        >
          {{ c.label }}
        </option>
      </select></label
    ><label
      >Tipo<select v-model="type" @change="page = 1">
        <option value="">Todos</option>
        <option v-for="t in types.data.value" :key="t.id" :value="t.id">
          {{ t.label }}
        </option>
      </select></label
    >
  </div>
  <details class="advanced-filters">
    <summary>Mais filtros</summary>
    <div class="toolbar">
      <label
        >Data inicial<input
          v-model="from"
          type="date"
          @change="page = 1" /></label
      ><label
        >Data final<input
          v-model="to"
          type="date"
          :min="from"
          @change="page = 1" /></label
      ><label
        >ID do membro<input
          v-model.lazy="member"
          inputmode="numeric"
          placeholder="Todos"
          @change="page = 1" /></label
      ><label
        >ID do período<input
          v-model.lazy="period"
          inputmode="numeric"
          placeholder="Todos"
          @change="page = 1" /></label
      ><button
        class="secondary"
        @click="
          from = '';
          to = '';
          member = '';
          period = '';
          page = 1;
        "
      >
        Limpar filtros adicionais
      </button>
    </div>
  </details>
  <section class="section">
    <div class="section-head">
      <h2>Despesas registradas</h2>
      <span class="muted" style="font-size: 12px"
        >{{ query.data.value?.total ?? "—" }} registros</span
      >
    </div>
    <QueryState
      :loading="query.loading.value"
      :error="query.error.value"
      :empty="!query.data.value?.results.length"
      @retry="query.refresh"
      ><RouterLink
        v-for="e in query.data.value?.results"
        :key="e.id"
        :to="`/despesas/${e.id}`"
        class="row row-link"
        ><div>
          <span class="row-title">{{ e.label }}</span
          ><span class="row-meta"
            >{{ e.expense_type_slug }} · {{ e.parcels }} parcela(s) ·
            {{ label(e.status) }}</span
          >
        </div>
        <div class="row-main">
          <div class="row-end">
            <strong>{{ money(e.total_value) }}</strong
            ><span class="row-meta"
              ><span :class="['badge', { success: e.payed }]">{{
                e.payed ? "Paga" : "A pagar"
              }}</span></span
            >
          </div>
          <ChevronRight
            aria-hidden="true"
            :size="16"
          /></div></RouterLink></QueryState
    ><Pagination
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
