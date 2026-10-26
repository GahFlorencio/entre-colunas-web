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
import { user, token, lodgeId } from "@/lib/session";
import { money, date, label } from "@/lib/format";
import { useQuery } from "@/lib/query";
import { readLodgeFinancialSummary } from "@/domain/lodge-financial/summary-source";
import type { LodgeFinancialSummary } from "@/domain/lodge-financial/summary-state";
import { listLodgeFinancialMovements } from "@/domain/lodge-financial/api";
import { listFinancialPeriods } from "@/domain/financial-periods/api";
import QueryState from "@/components/QueryState.vue";
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
  <div class="page-header">
    <div>
      <p class="eyebrow">SUA LOJA EM PERSPECTIVA</p>
      <h1>Olá, {{ user?.name.split(" ")[0] }}.</h1>
      <p>Um olhar sobre o que acontece entre colunas.</p>
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
          Caixa da loja <Wallet aria-hidden="true" :size="20" />
        </div>
        <strong>{{ money(summary.data.value.cash_balance) }}</strong
        ><small>Caixa administrativo atual</small>
      </article>
      <article class="stat">
        <div class="stat-top">
          Despesas a pagar <Receipt aria-hidden="true" :size="20" />
        </div>
        <strong>{{ money(summary.data.value.unpaid_expenses_total) }}</strong
        ><small>Total de despesas ainda não pagas</small>
      </article>
      <article class="stat">
        <div class="stat-top">
          Valores a receber <HandCoins aria-hidden="true" :size="20" />
        </div>
        <strong>{{
          money(summary.data.value.accounts_receivable_total)
        }}</strong
        ><small>Saldos devedores dos membros</small>
      </article>
    </div></QueryState
  >
  <p class="eyebrow" style="margin-bottom: 14px">PARA O SEU DIA A DIA</p>
  <div class="quick-actions">
    <RouterLink class="quick-action" to="/membros?novo=1"
      ><UserPlus aria-hidden="true" :size="21" />
      <div>
        <strong>Cadastrar membro</strong
        ><small>Traga alguém para o quadro</small>
      </div>
      <ArrowUpRight
        aria-hidden="true"
        :size="16"
        style="margin-left: auto" /></RouterLink
    ><RouterLink class="quick-action" to="/despesas?novo=1"
      ><Plus aria-hidden="true" :size="21" />
      <div>
        <strong>Registrar despesa</strong
        ><small>Mantenha as contas em dia</small>
      </div>
      <ArrowUpRight
        aria-hidden="true"
        :size="16"
        style="margin-left: auto" /></RouterLink
    ><RouterLink class="quick-action" to="/operacoes?novo=1"
      ><HandCoins aria-hidden="true" :size="21" />
      <div>
        <strong>Registrar entrada</strong
        ><small>Organize os recebimentos</small>
      </div>
      <ArrowUpRight aria-hidden="true" :size="16" style="margin-left: auto"
    /></RouterLink>
  </div>
  <div class="two-columns">
    <section class="section">
      <div class="section-head">
        <h2>Últimas movimentações</h2>
        <RouterLink class="text-button" to="/extrato"
          >Ver extrato <ArrowRight aria-hidden="true" :size="15"
        /></RouterLink>
      </div>
      <QueryState
        :loading="movements.loading.value"
        :error="movements.error.value"
        :empty="!movements.data.value?.results.length"
        @retry="movements.refresh"
        ><RouterLink
          v-for="m in movements.data.value?.results"
          :key="m.id"
          :to="`/operacoes/${m.financial_operation_id}`"
          class="row row-link"
          ><div>
            <span class="row-title">{{ m.description }}</span
            ><span class="row-meta"
              >{{ label(m.operation_type) }} · {{ date(m.created_at) }}</span
            >
          </div>
          <strong
            :class="m.direction === 'credit' ? 'positive' : 'negative'"
            style="font-size: 14px"
            >{{ m.direction === "credit" ? "+" : "−" }}
            {{ money(m.value) }}</strong
          ></RouterLink
        ></QueryState
      >
    </section>
    <section class="section">
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
          <h2 style="font-size: 28px; margin: 20px 0 10px">
            Período {{ current.sequence }}
          </h2>
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
</template>
