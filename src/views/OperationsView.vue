<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Plus, ChevronRight } from "@lucide/vue";
import { token, lodgeId } from "@/lib/session";
import { label, date } from "@/lib/format";
import { useQuery } from "@/lib/query";
import { listFinancialOperations } from "@/domain/financial-operations/api";
import QueryState from "@/components/QueryState.vue";
import Pagination from "@/components/Pagination.vue";
import OperationForm from "@/components/OperationForm.vue";
const route = useRoute(),
  router = useRouter(),
  showForm = ref(route.query.novo === "1"),
  page = ref(1),
  type = ref(""),
  member = ref(""),
  period = ref("");
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
function close() {
  showForm.value = false;
  void router.replace({ query: {} });
}
</script>
<template>
  <div class="page-header">
    <div>
      <p class="eyebrow">REGISTROS FINANCEIROS</p>
      <h1>Operações</h1>
      <p>Entradas, pagamentos e ajustes com histórico.</p>
    </div>
    <button @click="showForm = true">
      <Plus aria-hidden="true" :size="18" />Registrar operação
    </button>
  </div>
  <div class="toolbar">
    <label
      >Tipo<select v-model="type" @change="page = 1">
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
    ><label
      >ID do membro<input
        v-model.lazy="member"
        inputmode="numeric"
        pattern="[1-9][0-9]*"
        placeholder="Todos"
        @change="page = 1" /></label
    ><label
      >ID do período<input
        v-model.lazy="period"
        inputmode="numeric"
        pattern="[1-9][0-9]*"
        placeholder="Todos"
        @change="page = 1"
    /></label>
  </div>
  <section class="section">
    <QueryState
      :loading="query.loading.value"
      :error="query.error.value"
      :empty="!query.data.value?.results.length"
      @retry="query.refresh"
      ><RouterLink
        v-for="o in query.data.value?.results"
        :key="o.id"
        :to="`/operacoes/${o.id}`"
        class="row row-link"
        ><div>
          <span class="row-title">{{ o.description }}</span
          ><span class="row-meta"
            >{{ label(o.type) }} · {{ date(o.created_at) }}</span
          >
        </div>
        <div class="row-main">
          <span class="badge">#{{ o.id }}</span
          ><ChevronRight
            aria-hidden="true"
            :size="16"
          /></div></RouterLink></QueryState
    ><Pagination
      v-if="query.data.value"
      v-model:page="page"
      :total="query.data.value.total"
    />
  </section>
  <OperationForm
    v-if="showForm"
    @close="close"
    @saved="
      close();
      query.refresh();
    "
  />
</template>
