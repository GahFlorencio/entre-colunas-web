<script setup lang="ts">
import { ref } from "vue";
import { token, lodgeId } from "@/lib/session";
import { date, label } from "@/lib/format";
import { useQuery } from "@/lib/query";
import { listMemberFinancialPeriods } from "@/domain/member-account/periods-api";
import QueryState from "./QueryState.vue";
const props = defineProps<{ memberId: string }>(),
  page = ref(1);
const query = useQuery(
  () => listMemberFinancialPeriods(token.value, lodgeId.value, page.value),
  () => page.value,
);
</script>
<template>
  <section class="section">
    <div class="section-head"><h2>Consultar cobranças por período</h2></div>
    <QueryState
      :loading="query.loading.value"
      :error="query.error.value"
      :empty="!query.data.value?.items.length"
      @retry="query.refresh"
      ><RouterLink
        v-for="p in query.data.value?.items"
        :key="p.id"
        :to="`/membros/${memberId}/periodos/${p.id}`"
        class="row row-link"
        ><div>
          <span class="row-title">Período {{ p.sequence }}</span
          ><span class="row-meta">Aberto em {{ date(p.opened_at) }}</span>
        </div>
        <span class="badge">{{ label(p.status) }}</span></RouterLink
      ></QueryState
    >
    <div class="pagination">
      <span>Página {{ page }}</span>
      <div>
        <button
          class="secondary"
          :disabled="page <= 1 || query.loading.value"
          @click="page--"
        >
          Anterior</button
        ><button
          class="secondary"
          :disabled="!query.data.value?.nextPage || query.loading.value"
          @click="page++"
        >
          Próxima
        </button>
      </div>
    </div>
  </section>
</template>
