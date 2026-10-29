<script setup lang="ts">
import { computed } from "vue";
import {
  Wallet,
  Receipt,
  HandCoins,
  UserPlus,
  Plus,
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
} from "@lucide/vue";
import { token, lodgeId } from "@/lib/session";
import { money, date } from "@/lib/format";
import { useQuery } from "@/lib/query";
import { readLodgeFinancialSummary } from "@/domain/lodge-financial/summary-source";
import type { LodgeFinancialSummary } from "@/domain/lodge-financial/summary-state";
import { listLodgeFinancialMovements } from "@/domain/lodge-financial/api";
import { listFinancialPeriods } from "@/domain/financial-periods/api";
import QueryState from "@/components/QueryState.vue";
import MovementList from "@/components/MovementList.vue";
const movementItems = computed(() =>
  (movements.data.value?.results ?? []).map((m) => ({
    key: m.id,
    description: m.description,
    value: m.value,
    direction: m.direction,
    group: date(m.created_at),
    meta: [date(m.created_at), m.category_label].filter(Boolean).join(" - "),
    to: `/operacoes/${m.financial_operation_id}`,
  })),
);
const summary = useQuery(
  async () =>
    (await readLodgeFinancialSummary(
      token.value,
      lodgeId.value,
    )) as LodgeFinancialSummary,
);
const movements = useQuery(() =>
  listLodgeFinancialMovements(token.value, lodgeId.value, {
    page: 1,
    perPage: 5,
  }),
);
const periods = useQuery(() =>
  listFinancialPeriods(token.value, lodgeId.value, {
    page: 1,
    perPage: 1,
    status: "open",
  }),
);
const current = computed(() => periods.data.value?.results[0]);
const today = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date());
</script>
<template>
  <div class="overview">
    <div class="page-header overview-header">
      <div>
        <h1>Visão geral</h1>
      </div>
      <span
        class="muted"
        style="font-size: 12px; display: flex; gap: 8px; align-items: center"
        ><CalendarDays aria-hidden="true" :size="16" />{{ today }}</span
      >
    </div>
    <QueryState
      :loading="summary.loading.value"
      :error="summary.error.value"
      @retry="summary.refresh"
      ><div v-if="summary.data.value" class="stat-grid">
        <article class="stat">
          <div class="stat-top">
            Caixa <Wallet aria-hidden="true" :size="20" />
          </div>
          <strong>{{ money(summary.data.value.cash_balance) }}</strong
          ><small>Caixa administrativo atual</small>
        </article>
        <article class="stat">
          <div class="stat-top">
            A pagar <Receipt aria-hidden="true" :size="20" />
          </div>
          <strong>{{ money(summary.data.value.unpaid_expenses_total) }}</strong
          ><small>Total de despesas ainda não pagas</small>
        </article>
        <article class="stat">
          <div class="stat-top">
            A receber <HandCoins aria-hidden="true" :size="20" />
          </div>
          <strong>{{
            money(summary.data.value.accounts_receivable_total)
          }}</strong
          ><small>Saldos devedores dos membros</small>
        </article>
      </div></QueryState
    >

    <div class="quick-actions">
      <RouterLink class="quick-action" to="/membros?novo=1"
        ><UserPlus aria-hidden="true" :size="21" />
        <div>
          <strong>Novo membro</strong>
        </div>
        <ArrowUpRight
          aria-hidden="true"
          :size="16"
          style="margin-left: auto" /></RouterLink
      ><RouterLink class="quick-action" to="/despesas?novo=1"
        ><Plus aria-hidden="true" :size="21" />
        <div>
          <strong>Nova despesa</strong>
        </div>
        <ArrowUpRight
          aria-hidden="true"
          :size="16"
          style="margin-left: auto" /></RouterLink
      ><RouterLink class="quick-action" to="/operacoes?novo=1"
        ><HandCoins aria-hidden="true" :size="21" />
        <div>
          <strong>Nova entrada</strong>
        </div>
        <ArrowUpRight aria-hidden="true" :size="16" style="margin-left: auto"
      /></RouterLink>
    </div>
    <div class="two-columns">
      <section class="section">
        <div class="section-head">
          <h2>Movimentações</h2>
          <RouterLink class="text-button" to="/extrato"
            >Extrato <ArrowRight aria-hidden="true" :size="15"
          /></RouterLink>
        </div>
        <QueryState
          :loading="movements.loading.value"
          :error="movements.error.value"
          :empty="!movements.data.value?.results.length"
          @retry="movements.refresh"
          ><div class="overview-movements">
            <MovementList :items="movementItems" :show-dates="false" /></div
        ></QueryState>
      </section>
      <section class="section current-period">
        <div class="section-head">
          <h2>Período atual</h2>
          <CalendarDays aria-hidden="true" :size="19" class="muted" />
        </div>
        <QueryState
          :loading="periods.loading.value"
          :error="periods.error.value"
          @retry="periods.refresh"
          ><div class="section-body" v-if="current">
            <span class="badge success">Aberto</span>
            <h2 class="current-period-title">Período {{ current.sequence }}</h2>
            <p class="muted" style="font-size: 13px">
              Aberto em {{ date(current.opened_at) }}<br />{{
                current.captured_members
              }}
              membros capturados
            </p>
            <RouterLink :to="`/periodos/${current.id}`" class="text-button"
              >Acompanhar período <ArrowRight aria-hidden="true" :size="16"
            /></RouterLink>
          </div>
          <div class="section-body" v-else>
            <p class="muted">Nenhum período aberto no momento.</p>
            <RouterLink to="/periodos" class="text-button"
              >Gerenciar períodos <ArrowRight aria-hidden="true" :size="16"
            /></RouterLink></div
        ></QueryState>
      </section>
    </div>
  </div>
</template>

<style scoped>
.overview {
  min-width: 0;
}
.overview-header {
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 8px 16px;
}
.overview-header h1 {
  margin: 0;
}
.stat-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.stat {
  min-width: 0;
  padding: 16px 12px;
}
.stat:first-child {
  grid-column: 1 / -1;
  padding: 16px;
}
.stat-top {
  margin-bottom: 8px;
  gap: 8px;
}
.stat-top svg {
  flex-shrink: 0;
}
.stat strong {
  font-size: clamp(18px, 4.5vw, 26px);
  letter-spacing: -0.5px;
  font-variant-numeric: tabular-nums;
  margin-bottom: 8px;
}
.stat:first-child strong {
  font-size: 30px;
}
.stat small {
  display: block;
  line-height: 1.5;
  font-size: 12px;
}
.quick-actions {
  gap: 0;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border);
}
.quick-action {
  min-width: 0;
  min-height: 44px;
  padding: 12px;
  gap: 8px;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
.quick-action:hover {
  background: var(--surface-subtle);
}
.quick-action + .quick-action {
  border-left: 1px solid var(--border);
}
.quick-action strong {
  margin: 0;
}
.two-columns {
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.section {
  min-width: 0;
  margin-bottom: 0;
}
.section-head {
  padding: 12px 16px;
  gap: 8px;
  flex-wrap: wrap;
}
.section-head h2 {
  font-size: 16px;
}
.text-button {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.overview-movements {
  padding: 0 16px 8px;
}
.section-body {
  padding: 16px;
}
.current-period-title {
  font-size: 20px;
  margin: 12px 0 8px;
  overflow-wrap: anywhere;
}
.current-period .section-body > p {
  margin-bottom: 8px;
}
@media (min-width: 768px) {
  .stat-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .stat:first-child {
    grid-column: auto;
  }
  .stat,
  .stat:first-child {
    padding: 20px;
  }
  .stat strong,
  .stat:first-child strong {
    font-size: clamp(22px, 2.5vw, 30px);
  }
  .quick-action {
    flex-direction: row;
    align-items: center;
    padding: 16px;
  }
}
@media (min-width: 1024px) {
  .two-columns {
    grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
  }
}
</style>
