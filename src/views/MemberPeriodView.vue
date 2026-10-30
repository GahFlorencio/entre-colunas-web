<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { ArrowLeft, Download } from "@lucide/vue";
import { token, lodgeId, lodge } from "@/lib/session";
import { money, date, message } from "@/lib/format";
import { useQuery } from "@/lib/query";
import {
  getMemberPeriodReport,
  chargeTypeLabel,
} from "@/domain/member-account/period-report";
import QueryState from "@/components/QueryState.vue";
import MovementList from "@/components/MovementList.vue";
import Pagination from "@/components/Pagination.vue";
const route = useRoute();
const memberId = computed(() => String(route.params.id));
const periodId = computed(() => String(route.params.periodId));
const page = ref(1),
  exporting = ref(false),
  exportError = ref("");
const query = useQuery(
  async () => {
    page.value = 1;
    return getMemberPeriodReport(
      token.value,
      lodgeId.value,
      memberId.value,
      periodId.value,
    );
  },
  () => [memberId.value, periodId.value],
);
const lines = computed(() =>
  (query.data.value?.items ?? [])
    .slice((page.value - 1) * 20, page.value * 20)
    .map((item) => ({
      key: item.key,
      description: item.description,
      value: item.value,
      direction: item.direction,
      group:
        query.data.value?.status === "open"
          ? "Previsto no período"
          : `Fechamento em ${date(query.data.value?.closed_at)}`,
      meta: [
        query.data.value?.status === "closed"
          ? date(query.data.value.closed_at)
          : null,
        chargeTypeLabel(item.type),
        item.category_label,
      ]
        .filter(Boolean)
        .join(" · "),
      ...(item.financial_operation_id
        ? { to: `/operacoes/${item.financial_operation_id}` }
        : {}),
    })),
);
async function exportPdf() {
  if (!query.data.value || exporting.value) return;
  const report = query.data.value;
  const context = {
    token: token.value,
    lodgeId: lodgeId.value,
    memberId: memberId.value,
    periodId: periodId.value,
  };
  const lodgeName = `${lodge.value?.label ?? "Loja"} · Nº ${lodge.value?.number ?? ""}`;
  exporting.value = true;
  exportError.value = "";
  try {
    const { buildMemberPeriodPdf } =
      await import("@/domain/member-account/period-report-pdf");
    if (
      context.token !== token.value ||
      context.lodgeId !== lodgeId.value ||
      context.memberId !== memberId.value ||
      context.periodId !== periodId.value ||
      report !== query.data.value
    )
      throw new Error(
        "A seleção mudou. Atualize o relatório e tente novamente.",
      );
    buildMemberPeriodPdf(report, lodgeName).save(
      `membro-${report.member_id}-periodo-${report.sequence}.pdf`,
    );
  } catch (error) {
    exportError.value = message(error);
  } finally {
    exporting.value = false;
  }
}
</script>
<template>
  <div class="member-period-page">
    <RouterLink class="back-link" :to="`/membros/${memberId}?aba=periodos`"
      ><ArrowLeft aria-hidden="true" :size="16" />Períodos do membro</RouterLink
    >
    <QueryState
      :loading="query.loading.value"
      :error="query.error.value"
      @retry="query.refresh"
      ><template v-if="query.data.value">
        <header class="member-period-heading">
          <div>
            <div class="member-period-title">
              <h1>Período {{ query.data.value.sequence }}</h1>
              <span
                :class="[
                  'badge',
                  { success: query.data.value.status === 'open' },
                ]"
                >{{
                  query.data.value.status === "open"
                    ? "Aberto · Prévia"
                    : "Fechado"
                }}</span
              >
            </div>
            <p>{{ query.data.value.member_name }}</p>
            <p class="member-period-dates">
              {{ date(query.data.value.opened_at) }} —
              {{
                query.data.value.closed_at
                  ? date(query.data.value.closed_at)
                  : "Em andamento"
              }}
            </p>
          </div>
          <button class="secondary" :disabled="exporting" @click="exportPdf">
            <Download :size="18" aria-hidden="true" />{{
              exporting ? "Gerando…" : "PDF"
            }}
          </button>
        </header>
        <p v-if="exportError" class="alert" role="alert">{{ exportError }}</p>
        <section class="member-period-total" aria-label="Total do período">
          <span>Cobranças do período</span
          ><strong>{{ money(query.data.value.total_charges) }}</strong
          ><small>{{
            query.data.value.status === "open"
              ? "Prévia do período · sujeita a alterações até o fechamento"
              : "Valores preservados no fechamento"
          }}</small>
        </section>
        <p class="member-period-note">
          Total das cobranças deste ciclo, incluindo acréscimo quando houver.
          Pagamentos, ajustes e saldo anterior não compõem este total.
        </p>
        <div
          v-if="query.data.value.impediments.length"
          class="notice"
          role="status"
        >
          <strong>Prévia com pendências</strong>
          <ul>
            <li v-for="item in query.data.value.impediments" :key="item">
              {{ item }}
            </li>
          </ul>
        </div>
        <section aria-labelledby="member-charges-title">
          <h2 id="member-charges-title">Extrato do período</h2>
          <MovementList v-if="lines.length" :items="lines" />
          <div v-else class="state">
            <strong>Nenhuma cobrança neste período</strong>
          </div>
          <Pagination
            v-if="query.data.value.items.length"
            v-model:page="page"
            :total="query.data.value.items.length"
          />
        </section> </template
    ></QueryState>
  </div>
</template>
<style scoped>
.member-period-page {
  min-width: 0;
}
.member-period-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}
.member-period-heading > div {
  min-width: 0;
}
.member-period-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.member-period-title h1 {
  font-size: 24px;
  margin: 0;
}
.member-period-heading p {
  font-size: 14px;
  margin: 8px 0 0;
  overflow-wrap: anywhere;
}
.member-period-heading .member-period-dates {
  color: var(--muted);
  font-size: 12px;
}
.member-period-heading button {
  flex-shrink: 0;
  min-height: 44px;
}
.member-period-total {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-surface);
  padding: 20px;
  display: grid;
  gap: 8px;
}
.member-period-total span {
  font-size: 13px;
  color: var(--muted);
}
.member-period-total strong {
  font-size: 28px;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.member-period-total small {
  font-size: 12px;
  color: var(--muted);
}
.member-period-note {
  font-size: 12px;
  line-height: 1.6;
  color: var(--muted);
  margin: 12px 0 24px;
}
h2 {
  font-size: 18px;
  margin: 0 0 16px;
}
.member-period-page :deep(.pagination) {
  padding: 16px 0;
  border: 0;
}
@media (min-width: 768px) {
  .member-period-title h1 {
    font-size: 28px;
  }
  .member-period-total {
    padding: 24px;
  }
}
</style>
