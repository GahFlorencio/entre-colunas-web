<script setup lang="ts">
import { computed } from "vue";
import {
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
    perPage: 3,
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
        <RouterLink
          to="/operacoes"
          class="stat cash-highlight"
          aria-label="Consultar caixa administrativo"
        >
          <div class="stat-top">Caixa administrativo</div>
          <strong>{{ money(summary.data.value.cash_balance) }}</strong
          ><small>Entradas líquidas menos despesas pagas</small>
        </RouterLink>
        <RouterLink
          to="/despesas?pagamento=pendente"
          class="stat"
          aria-label="Consultar despesas a pagar"
        >
          <div class="stat-top">A pagar</div>
          <strong>{{ money(summary.data.value.unpaid_expenses_total) }}</strong
          ><small>Total de despesas ainda não pagas</small>
        </RouterLink>
        <RouterLink
          to="/membros"
          class="stat"
          aria-label="Consultar posição financeira dos membros"
        >
          <div class="stat-top">A receber</div>
          <strong>{{
            money(summary.data.value.accounts_receivable_total)
          }}</strong
          ><small>Saldos devedores dos membros</small>
        </RouterLink>
      </div></QueryState
    >

    <p v-if="summary.data.value" class="summary-reference">
      Totais da loja · calculados em
      {{ date(summary.data.value.calculated_at) }}
    </p>
    <div class="quick-actions">
      <RouterLink class="quick-action" to="/membros?novo=1"
        ><UserPlus aria-hidden="true" :size="21" />
        <div>
          <strong>Membro</strong>
        </div>
        <ArrowUpRight
          aria-hidden="true"
          :size="16"
          style="margin-left: auto" /></RouterLink
      ><RouterLink class="quick-action" to="/despesas?novo=1"
        ><Plus aria-hidden="true" :size="21" />
        <div>
          <strong>Despesas</strong>
        </div>
        <ArrowUpRight
          aria-hidden="true"
          :size="16"
          style="margin-left: auto" /></RouterLink
      ><RouterLink class="quick-action" to="/operacoes?novo=1&tipo=payment"
        ><HandCoins aria-hidden="true" :size="21" />
        <div>
          <strong>Receber</strong>
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
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}
.overview-header h1 {
  margin: 0;
}
.stat-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 8px;
}
.stat,
.stat:first-child {
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--border);
}
.stat:first-child {
  grid-column: 1/-1;
  background: var(--navy);
  color: #fff;
  border-color: var(--navy);
}
.stat-top {
  margin-bottom: 12px;
  gap: 8px;
  font-size: 13px;
}
.stat strong {
  font-size: clamp(18px, 4.5vw, 28px);
  letter-spacing: -0.7px;
  margin-bottom: 8px;
}
.stat:first-child strong {
  font-size: clamp(28px, 7vw, 38px);
}
.stat small {
  display: block;
  font-size: 12px;
  line-height: 1.5;
}
.stat:first-child small {
  color: #c8d5e5;
}
.stat:focus-visible {
  outline-offset: 3px;
}
.stat:hover {
  border-color: var(--gold);
}
.summary-reference {
  margin: 0 0 16px;
  font-size: 12px;
  color: var(--muted);
}
.quick-actions {
  gap: 8px;
  margin-bottom: 24px;
}
.quick-action {
  min-width: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
  padding: 12px 4px;
  gap: 8px;
}
.quick-action strong {
  margin: 0;
  font-size: 12px;
}
.quick-action > svg {
  flex-shrink: 0;
}
.quick-action:hover {
  background: var(--surface-subtle);
}
.two-columns {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.section {
  width: 100%;
  min-width: 0;
  margin: 0;
}
.current-period {
  order: -1;
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
  font-size: 13px;
}
.overview-movements {
  padding: 0 16px 8px;
}
.section-body {
  padding: 16px;
}
.current-period-title {
  font-size: 24px;
  margin: 12px 0 8px;
}
.current-period .section-body > p {
  margin-bottom: 8px;
}
@media (min-width: 768px) {
  .stat-grid {
    grid-template-columns: minmax(0, 2fr) repeat(2, minmax(0, 1fr));
  }
  .stat:first-child {
    grid-column: auto;
  }
  .stat,
  .stat:first-child {
    padding: 24px;
  }
  .stat strong {
    font-size: clamp(20px, 2.5vw, 30px);
  }
  .stat:first-child strong {
    font-size: clamp(28px, 3vw, 38px);
  }
  .quick-action {
    flex-direction: row;
    align-items: center;
  }
  .two-columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
    align-items: start;
  }
}
@media (max-width: 767px) {
  .stat-grid {
    gap: 0;
  }
  .stat:first-child {
    min-height: 125px;
    margin-bottom: 12px;
    border-radius: 13px;
  }
  .stat:not(:first-child) {
    background: var(--surface-subtle);
    border: 0;
    border-radius: 0;
    padding: 14px 12px;
  }
  .stat:nth-child(2) {
    border-radius: 13px 0 0 13px;
    border-right: 1px solid var(--border);
  }
  .stat:nth-child(3) {
    border-radius: 0 13px 13px 0;
  }
  .stat-top {
    margin-bottom: 4px;
  }
  .stat strong {
    overflow-wrap: anywhere;
  }
  .quick-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-bottom: 12px;
  }
  .quick-action {
    flex-direction: column;
    justify-content: center;
    padding: 8px 0;
    gap: 4px;
  }
  .quick-action:last-child {
    order: -2;
  }
  .quick-action:nth-child(2) {
    order: -1;
  }
  .quick-action > svg:last-child {
    display: none;
  }
  .section {
    background: transparent;
    border: 0;
    box-shadow: none;
  }
  .section-head {
    background: transparent;
    border: 0;
  }
  .current-period {
    border-radius: 0;
  }
  .section-head,
  .overview-movements {
    padding-left: 0;
    padding-right: 0;
  }
  .current-period {
    border-block: 1px solid var(--border);
    padding: 8px 0;
  }
  .current-period .section-head {
    display: none;
  }
  .current-period .section-body {
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
  }
  .current-period-title {
    margin: 0;
    font-size: 16px;
  }
  .current-period .section-body > p {
    display: none;
  }
  .current-period .text-button {
    margin-left: auto;
  }
}
</style>
