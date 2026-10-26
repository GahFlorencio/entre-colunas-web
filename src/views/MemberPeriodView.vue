<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";
import { ArrowLeft } from "@lucide/vue";
import { token, lodgeId } from "@/lib/session";
import { money, date } from "@/lib/format";
import { useQuery } from "@/lib/query";
import { listMemberPeriodDebits } from "@/domain/member-account/periods-api";
import QueryState from "@/components/QueryState.vue";
const route = useRoute(),
  memberId = String(route.params.id),
  periodId = String(route.params.periodId),
  page = ref(1);
const query = useQuery(
  () =>
    listMemberPeriodDebits(
      token.value,
      lodgeId.value,
      memberId,
      periodId,
      page.value,
    ),
  () => page.value,
);
const previous = ref<number[]>([]);
function next() {
  if (query.data.value?.nextPage) {
    previous.value.push(page.value);
    page.value = query.data.value.nextPage;
  }
}
function back() {
  const value = previous.value.pop();
  if (value) page.value = value;
}
</script>
<template>
  <RouterLink class="back-link" :to="`/membros/${memberId}`"
    ><ArrowLeft aria-hidden="true" :size="16" />Voltar ao membro</RouterLink
  >
  <div class="page-header">
    <div>
      <p class="eyebrow">COBRANÇAS DO MEMBRO</p>
      <h1>Movimentos do período</h1>
      <p>
        Débitos lançados na conta do membro #{{ memberId }} · Período #{{
          periodId
        }}
      </p>
    </div>
  </div>
  <section class="section">
    <QueryState
      :loading="query.loading.value"
      :error="query.error.value"
      :empty="!query.data.value?.items.length"
      @retry="query.refresh"
      ><RouterLink
        v-for="m in query.data.value?.items"
        :key="m.id"
        :to="`/operacoes/${m.financial_operation_id}`"
        class="row row-link"
        ><div>
          <span class="row-title">{{ m.description }}</span
          ><span class="row-meta"
            >{{ date(m.created_at) }} ·
            {{ m.category_label || "Sem categoria" }}</span
          >
        </div>
        <strong class="negative">{{ money(m.value) }}</strong></RouterLink
      ></QueryState
    >
    <div class="pagination">
      <span>Consulta de débitos lançados</span>
      <div>
        <button
          class="secondary"
          :disabled="!previous.length || query.loading.value"
          @click="back"
        >
          Anterior</button
        ><button
          class="secondary"
          :disabled="!query.data.value?.nextPage || query.loading.value"
          @click="next"
        >
          Próxima
        </button>
      </div>
    </div>
  </section>
  <p class="muted" style="font-size: 12px">
    A data exibida é a data da operação. Cobranças futuras ainda não lançadas
    não aparecem nesta consulta.
  </p>
</template>
