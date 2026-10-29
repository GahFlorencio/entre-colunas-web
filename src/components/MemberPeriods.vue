<script setup lang="ts">
import { ref } from "vue";
import { token, lodgeId } from "@/lib/session";
import { date, label } from "@/lib/format";
import { useQuery } from "@/lib/query";
import { listMemberFinancialPeriods } from "@/domain/member-account/periods-api";
import { CalendarDays, ChevronRight, RefreshCw } from "@lucide/vue";
import MemberPeriodTotal from "./MemberPeriodTotal.vue";
import QueryState from "./QueryState.vue";
const props = defineProps<{ memberId: string }>(),
  page = ref(1);
const totalsVersion = ref(0);
const query = useQuery(
  () => listMemberFinancialPeriods(token.value, lodgeId.value, page.value),
  () => page.value,
);
</script>
<template>
  <section class="member-periods">
    <div class="periods-heading">
      <div>
        <h2>Cobranças por período</h2>
        <p>Cobranças do membro em cada ciclo. Abertos mostram a prévia.</p>
      </div>
      <button
        class="secondary icon-button"
        aria-label="Atualizar totais dos períodos"
        title="Atualizar totais dos períodos"
        @click="totalsVersion++"
      >
        <RefreshCw :size="17" aria-hidden="true" />
      </button>
    </div>
    <QueryState
      :loading="query.loading.value"
      :error="query.error.value"
      :empty="!query.data.value?.items.length"
      @retry="query.refresh"
      ><RouterLink
        v-for="p in query.data.value?.items"
        :key="p.id"
        :to="`/membros/${memberId}/periodos/${p.id}`"
        class="period-option"
        ><span class="period-symbol" aria-hidden="true"
          ><CalendarDays :size="20"
        /></span>
        <div class="period-description">
          <span class="row-title">Período {{ p.sequence }}</span
          ><span class="row-meta"
            >{{ date(p.opened_at) }} —
            {{ p.closed_at ? date(p.closed_at) : "Em andamento" }}</span
          >
        </div>
        <MemberPeriodTotal
          :key="`${p.id}:${totalsVersion}`"
          class="period-amount"
          :member-id="memberId"
          :period-id="p.id" />
        <span :class="['badge', { success: p.status === 'open' }]">{{
          label(p.status)
        }}</span
        ><ChevronRight
          class="period-chevron"
          :size="17"
          aria-hidden="true" /></RouterLink
    ></QueryState>
    <div v-if="query.data.value" class="pagination">
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

<style scoped>
.periods-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}
.periods-heading h2 {
  font-size: 18px;
  margin: 0 0 6px;
}
.periods-heading p {
  font-size: 12px;
  color: var(--muted);
  margin: 0;
}
.period-option {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 16px;
  gap: 8px 12px;
  align-items: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-surface);
  padding: 14px;
  margin-bottom: 10px;
}
.period-option:hover {
  border-color: var(--gold);
}
.period-description {
  min-width: 0;
}
.period-option .row-meta {
  line-height: 1.5;
  overflow-wrap: anywhere;
  margin-top: 4px;
}
.period-symbol {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--gold-bg);
  color: var(--gold);
  display: grid;
  place-items: center;
  grid-row: 1 / 4;
}
.period-amount {
  grid-column: 2;
}
.period-option .badge {
  grid-column: 2;
  justify-self: start;
}
.period-chevron {
  grid-column: 3;
  grid-row: 1 / 4;
  color: var(--muted);
}
.pagination {
  padding: 14px 0;
  border: 0;
  flex-wrap: wrap;
}
@media (min-width: 600px) {
  .period-option {
    grid-template-columns: 40px minmax(0, 1fr) minmax(0, auto) auto 16px;
    padding: 16px;
  }
  .period-symbol {
    grid-row: auto;
  }
  .period-amount {
    grid-column: auto;
    max-width: 220px;
  }
  .period-option .badge {
    grid-column: auto;
  }
  .period-chevron {
    grid-column: auto;
    grid-row: auto;
  }
}
</style>
