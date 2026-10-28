<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowLeft, Download } from "@lucide/vue";
import {
  periodReportLines,
  periodReportStatementTotal,
} from "@/domain/financial-periods/report-lines";
import { getPeriodReport } from "@/domain/financial-periods/api";
import { token, lodgeId, lodge } from "@/lib/session";
import { money, message } from "@/lib/format";
import { useQuery } from "@/lib/query";
import type { PeriodReportMetadata } from "@/domain/financial-periods/types";
import QueryState from "@/components/QueryState.vue";
const props = defineProps<{
  periodId: string;
  sequence: number;
  details: PeriodReportMetadata;
  status: "open" | "closed";
}>();
const addition = defineModel<string | number>("addition", { default: "0" });
const report = useQuery(
  () => {
    if (props.status === "open" && addition.value === "")
      throw new Error(
        "Informe o acréscimo por ativo. Use zero se não houver acréscimo.",
      );
    return getPeriodReport(
      token.value,
      lodgeId.value,
      props.periodId,
      props.status === "open" ? Number(addition.value) : undefined,
    );
  },
  () => [props.periodId, props.status, addition.value],
);
const statementLines = computed(() =>
  report.data.value ? periodReportLines(report.data.value) : [],
);
const statementTotal = computed(() =>
  report.data.value ? periodReportStatementTotal(report.data.value) : 0,
);
const tab = ref<"overview" | "statement" | "members">("overview"),
  exporting = ref(false),
  exportError = ref("");
const periodTabs = [
  { key: "overview", label: "Visão Geral" },
  { key: "statement", label: "Extrato" },
  { key: "members", label: "Membros" },
] as const;
function navigateTabs(event: KeyboardEvent) {
  const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  const buttons = Array.from(
    (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '[role="tab"]',
    ),
  );
  const current = periodTabs.findIndex((item) => item.key === tab.value);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? periodTabs.length - 1
        : (current +
            (event.key === "ArrowRight" ? 1 : -1) +
            periodTabs.length) %
          periodTabs.length;
  tab.value = periodTabs[next].key;
  buttons[next]?.focus();
}
async function exportPdf() {
  if (!report.data.value || exporting.value) return;
  exporting.value = true;
  exportError.value = "";
  try {
    const { downloadPeriodReport } =
      await import("@/domain/financial-periods/report-pdf");
    downloadPeriodReport(
      report.data.value,
      `${lodge.value?.label ?? "Loja"} · Nº ${lodge.value?.number ?? ""}`,
      props.details,
    );
  } catch (e) {
    exportError.value = message(e);
  } finally {
    exporting.value = false;
  }
}
</script>
<template>
  <div class="period-report">
    <header class="report-heading">
      <RouterLink
        to="/periodos"
        class="period-back"
        aria-label="Todos os períodos"
        ><ArrowLeft aria-hidden="true" :size="18"
      /></RouterLink>
      <div class="report-title">
        <div class="report-title-line">
          <h1>Período {{ sequence }}</h1>
          <span :class="['badge', { success: status === 'open' }]">{{
            status === "open" ? "Aberto" : "Fechado"
          }}</span>
        </div>
        <p class="report-status">
          Cobrança por membro{{
            report.data.value?.acrescimo ? " · acréscimo incluso" : ""
          }}
        </p>
      </div>
      <button
        class="secondary pdf-button"
        aria-label="Exportar PDF"
        :disabled="!report.data.value || exporting"
        @click="exportPdf"
      >
        <Download aria-hidden="true" :size="16" />{{
          exporting ? "Gerando…" : "PDF"
        }}
      </button>
    </header>
    <div
      class="period-tabs"
      role="tablist"
      aria-label="Visões do período"
      @keydown="navigateTabs"
    >
      <button
        v-for="item in periodTabs"
        :id="`period-tab-${item.key}`"
        :key="item.key"
        role="tab"
        type="button"
        class="secondary"
        :class="{ selected: tab === item.key }"
        :aria-selected="tab === item.key"
        :aria-controls="`period-panel-${item.key}`"
        :tabindex="tab === item.key ? 0 : -1"
        @click="tab = item.key"
      >
        {{ item.label }}
      </button>
    </div>
    <p v-if="exportError" class="alert" role="alert">{{ exportError }}</p>
    <section
      v-show="tab === 'overview'"
      id="period-panel-overview"
      role="tabpanel"
      aria-labelledby="period-tab-overview"
      tabindex="0"
    >
      <slot name="details" />
      <div v-if="status === 'open'" class="period-addition">
        <label for="period-addition"
          >Acréscimo por ativo <span class="muted">(R$)</span></label
        >
        <input
          id="period-addition"
          v-model="addition"
          aria-label="Acréscimo por membro ativo (R$)"
          type="number"
          min="0"
          step="0.01"
          required
        />
      </div>
      <QueryState
        :loading="report.loading.value"
        :error="report.error.value"
        @retry="report.refresh"
      >
        <template v-if="report.data.value">
          <div class="period-cards">
            <article
              v-for="group in report.data.value.groups"
              :key="group.key"
              :class="[
                'period-card',
                {
                  'empty-group': !group.member_count,
                  'range-group': group.min_charge !== group.max_charge,
                },
              ]"
              :aria-label="group.label"
            >
              <div class="period-card-heading">
                <h3>{{ group.label }}</h3>
                <span class="period-member-count"
                  >{{ group.member_count }}
                  {{ group.member_count === 1 ? "membro" : "membros" }}</span
                >
              </div>
              <div class="period-card-value">
                <p class="period-charge">
                  {{
                    group.member_count
                      ? group.min_charge === group.max_charge
                        ? money(group.min_charge)
                        : `${money(group.min_charge)} a ${money(group.max_charge)}`
                      : "—"
                  }}
                </p>
                <span class="period-unit">{{
                  !group.member_count ? "Sem membros" : "por membro"
                }}</span>
              </div>
            </article>
          </div>
          <div class="period-total">
            <span>Total a cobrar</span
            ><strong>{{ money(report.data.value.total_charges) }}</strong>
          </div>
          <p v-if="report.data.value.other_members_count" class="notice">
            Outros membros: {{ money(report.data.value.other_charges) }},
            incluídos no total.
          </p>
          <p
            v-if="report.data.value.impediments.length"
            class="alert"
            role="alert"
          >
            Pendências para fechar:
            {{ report.data.value.impediments.join(" ") }}
          </p>
        </template>
      </QueryState>
    </section>
    <section
      v-show="tab === 'statement'"
      id="period-panel-statement"
      role="tabpanel"
      aria-labelledby="period-tab-statement"
      tabindex="0"
    >
      <QueryState
        :loading="report.loading.value"
        :error="report.error.value"
        @retry="report.refresh"
      >
        <section v-if="report.data.value" class="section period-statement">
          <div class="section-head">
            <h2>Extrato de despesas</h2>
            <span class="statement-count"
              >{{ statementLines.length }}
              {{ statementLines.length === 1 ? "item" : "itens" }}</span
            >
          </div>
          <p v-if="!statementLines.length" class="section-body muted">
            Nenhuma despesa neste período.
          </p>
          <div
            v-else
            class="period-expense-table"
            role="region"
            aria-label="Despesas do período"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Despesa</th>
                  <th scope="col">Destinatários</th>
                  <th scope="col">Parcela</th>
                  <th scope="col" class="amount">Total da despesa</th>
                  <th scope="col" class="amount">Neste período</th>
                  <th scope="col" class="amount">Por membro</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="e in statementLines"
                  :key="e.key"
                  :class="{
                    'increment-row': e.type === 'acrescimo',
                    'same-total': e.total_value === e.value,
                  }"
                >
                  <td class="expense-description">
                    <RouterLink
                      v-if="e.expense_id"
                      :to="`/despesas/${e.expense_id}`"
                      class="expense-name"
                      ><span class="expense-title">{{ e.description }}</span>
                      <span class="expense-context">
                        <span
                          :class="[
                            'expense-kind',
                            { individual: e.type === 'individual' },
                          ]"
                          >{{
                            e.type === "individual"
                              ? "Individual"
                              : e.type === "rateio"
                                ? "Rateio"
                                : "Geral"
                          }}</span
                        >
                        <span class="expense-category" :title="e.category">{{
                          e.category
                        }}</span>
                        <span class="expense-installment"
                          >{{ e.installment_number }}/{{
                            e.installments_count
                          }}</span
                        >
                      </span></RouterLink
                    >
                    <template v-else
                      ><span class="expense-name"
                        >Acréscimo por membro ativo</span
                      ><span class="expense-context"
                        >Somente ativos</span
                      ></template
                    >
                  </td>
                  <td class="expense-recipients">{{ e.allocation }}</td>
                  <td class="expense-parcel">
                    {{
                      e.installment_number === null
                        ? "Única"
                        : `${e.installment_number}/${e.installments_count}`
                    }}
                  </td>
                  <td class="amount">
                    <span class="value-label">Total</span
                    >{{ money(e.total_value) }}
                  </td>
                  <td class="amount cycle-amount">
                    <span class="value-label">No período</span
                    >{{ money(e.value) }}
                  </td>
                  <td class="amount allocated-amount">
                    <span class="value-label">Por membro</span
                    >{{
                      e.allocated_value === null
                        ? "—"
                        : money(e.allocated_value)
                    }}<span v-if="e.type !== 'geral'" class="recipient-count"
                      >{{ e.divisor }}
                      {{ e.divisor === 1 ? "membro" : "membros" }}</span
                    >
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colspan="4">Total do extrato</th>
                  <td class="amount">{{ money(statementTotal) }}</td>
                  <td class="amount">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </QueryState>
    </section>
    <section
      v-show="tab === 'members'"
      id="period-panel-members"
      role="tabpanel"
      aria-labelledby="period-tab-members"
      tabindex="0"
    >
      <slot name="members" />
    </section>
    <slot name="actions" />
  </div>
</template>
<style scoped>
.period-report {
  container-type: inline-size;
  min-width: 0;
}
.report-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
}
.period-back {
  display: inline-flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 44px;
  min-height: 44px;
  color: var(--muted);
}
.report-title {
  flex: 1;
  min-width: 0;
}
.report-title-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.report-title h1 {
  font-size: 20px;
  letter-spacing: -0.6px;
  margin: 0;
  line-height: 1.2;
}
.report-title .badge {
  font-size: 10px;
  padding: 3px 6px;
}
.report-status {
  font-size: 11px;
  line-height: 1.4;
  color: var(--muted);
  margin: 4px 0 0;
}
.pdf-button {
  flex-shrink: 0;
  min-height: 44px;
  padding: 8px 10px;
  font-size: 12px;
}
.period-addition {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  margin-bottom: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 10px;
}
.period-addition label {
  font-size: 13px;
  margin: 0;
}
.period-addition input {
  width: 104px;
  min-height: 44px;
  padding: 8px 10px;
  margin: 0;
  text-align: right;
}
.period-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.period-card {
  display: block;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}
.period-card:first-child {
  grid-column: 1 / -1;
  display: grid;
  background: var(--navy);
  color: #fff;
}
.period-card:first-child .period-member-count,
.period-card:first-child .period-unit,
.period-card:first-child.empty-group .period-charge {
  color: #b6c2d1;
}
.period-card:not(:first-child) .period-card-value {
  text-align: left;
  margin-top: 8px;
}
.period-card:not(:first-child) .period-charge {
  font-size: 20px;
}
.period-card:not(:first-child).range-group .period-charge {
  font-size: 16px;
}
.period-card h3 {
  font-size: 13px;
  line-height: 1.4;
  margin: 0 0 4px;
}
.period-member-count {
  display: block;
  font-size: 11px;
  color: var(--muted);
}
.period-card-value {
  text-align: right;
  min-width: 0;
}
.period-charge {
  font-size: 21px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.5px;
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.period-unit {
  display: block;
  font-size: 11px;
  line-height: 1.4;
  color: var(--muted);
  margin-top: 4px;
}
.empty-group {
  background: var(--bg);
}
.empty-group .period-charge {
  color: var(--muted);
}
.period-total {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 2px 10px;
  font-size: 13px;
}
.period-total strong {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}
.period-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  background: var(--border);
  border-radius: 10px;
  padding: 4px;
  margin: 12px 0 16px;
}
.period-tabs button {
  background: transparent;
  color: var(--muted);
  min-height: 44px;
  font-size: 13px;
  border-radius: 7px;
}
.period-tabs button.selected {
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 1px 3px #0000000d;
}
.period-statement .section-head {
  padding: 14px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.period-statement h2 {
  font-size: 15px;
}
.statement-count {
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}
.period-expense-table {
  width: 100%;
}
table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 13px;
  text-align: left;
}
thead {
  display: none;
}
tbody tr {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 8px 14px 12px;
  border-bottom: 1px solid var(--border);
  gap: 0 8px;
}
tbody td {
  border: 0;
  padding: 0;
  min-width: 0;
}
.expense-description {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}
.expense-name {
  display: block;
  min-width: 0;
  max-width: 100%;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
a.expense-name {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  min-height: 44px;
}
.expense-title {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
}
.expense-context {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  font-weight: 400;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.4;
}
.expense-kind {
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 10px;
  color: var(--text);
  white-space: nowrap;
}
.expense-kind.individual {
  background: var(--gold-bg);
  border-color: transparent;
}
.expense-category {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.expense-installment {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.expense-recipients,
.expense-parcel {
  display: none;
}
.amount {
  text-align: left;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.value-label {
  display: block;
  color: var(--muted);
  font-weight: 400;
  font-size: 11px;
  margin-bottom: 3px;
}
tbody tr.same-total {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.same-total .cycle-amount {
  display: none;
}
.allocated-amount {
  text-align: right;
  font-weight: 700;
}
.recipient-count {
  display: block;
  font-size: 10px;
  font-weight: 400;
  color: var(--muted);
  margin-top: 2px;
}
.increment-row {
  background: var(--gold-bg);
}
tfoot tr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  background: var(--bg);
}
tfoot th,
tfoot td {
  border: 0;
  padding: 0;
}
tfoot th {
  font-size: 12px;
  font-weight: 500;
}
tfoot td {
  font-weight: 700;
}
tfoot td:last-child {
  display: none;
}
@container (max-width: 370px) {
  .period-charge {
    font-size: 18px;
  }
  .period-card {
    padding: 12px;
  }
  .period-unit {
    font-size: 10px;
  }
}
@container (min-width: 700px) {
  .period-cards {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  .period-card,
  .period-card:first-child {
    display: block;
    grid-column: auto;
    padding: 18px;
  }
  .period-card-value {
    text-align: left;
    margin-top: 12px;
  }
  .period-charge {
    font-size: 23px;
  }
  .period-tabs {
    width: 100%;
  }
  .period-addition {
    max-width: 400px;
  }
  thead {
    display: table-header-group;
    background: var(--bg);
  }
  thead th {
    padding: 12px;
    font-size: 11px;
  }
  tbody tr {
    display: table-row;
  }
  thead th:first-child {
    width: 30%;
  }
  thead th:nth-child(2) {
    width: 17%;
  }
  thead th:nth-child(3) {
    width: 8%;
  }
  thead th:nth-child(n + 4) {
    width: 15%;
  }
  tbody td {
    vertical-align: top;
    padding: 12px;
    border-bottom: 1px solid var(--border);
  }
  .expense-description {
    display: table-cell;
    margin: 0;
  }
  .expense-recipients,
  .expense-parcel {
    display: table-cell;
    font-size: 12px;
  }
  .same-total .cycle-amount {
    display: table-cell;
  }
  .expense-name {
    font-size: 13px;
  }
  .value-label {
    display: none;
  }
  .amount,
  .allocated-amount {
    text-align: right;
  }
  tfoot tr {
    display: table-row;
  }
  tfoot th,
  tfoot td {
    padding: 14px 12px;
  }
  tfoot td:last-child {
    display: table-cell;
  }
}
</style>
