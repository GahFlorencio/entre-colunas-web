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
import MovementList from "@/components/MovementList.vue";
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
const movementItems = computed(() =>
  statementLines.value.map((e) => ({
    key: e.key,
    description: e.description,
    value: e.value,
    direction: "debit" as const,
    group: "",
    valueLabel: "No período",
    unsigned: true,
    meta: [
      e.type === "individual"
        ? "Individual"
        : e.type === "rateio"
          ? "Rateio"
          : e.type === "acrescimo"
            ? "Acréscimo"
            : "Geral",
      e.category,
      e.installment_number === null
        ? "Única"
        : `Parcela ${e.installment_number}/${e.installments_count}`,
      e.allocation,
      e.type !== "geral"
        ? `${e.divisor} ${e.divisor === 1 ? "membro" : "membros"}`
        : "",
    ]
      .filter(Boolean)
      .join(" · "),
    details: [
      { label: "Total da despesa", value: money(e.total_value) },
      {
        label: "Por membro",
        value: e.allocated_value === null ? "—" : money(e.allocated_value),
      },
    ],
    to: e.expense_id ? `/despesas/${e.expense_id}` : undefined,
  })),
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
          </div>
          <p v-if="!statementLines.length" class="section-body muted">
            Nenhuma despesa neste período.
          </p>
          <div
            v-else
            class="period-movements"
            role="region"
            aria-label="Despesas do período"
          >
            <MovementList :items="movementItems" :show-dates="false" />
          </div>
          <div
            v-if="statementLines.length"
            class="period-total statement-total"
          >
            <span>Total do extrato</span
            ><strong>{{ money(statementTotal) }}</strong>
          </div>
          <p
            v-if="statementLines.length"
            class="statement-count statement-footer"
          >
            {{ statementLines.length }}
            {{ statementLines.length === 1 ? "item" : "itens" }}
          </p>
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
  border-radius: var(--radius-control);
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
  border-radius: var(--radius-surface);
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
  background: var(--surface-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  padding: 4px;
  margin: 12px 0 16px;
}
.period-tabs button {
  background: transparent;
  color: var(--muted);
  min-height: 44px;
  font-size: 13px;
  border-radius: var(--radius-control);
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
.period-movements {
  padding: 0 14px;
}
.statement-total {
  margin: 0 14px;
}
.statement-footer {
  margin: 0;
  padding: 0 14px 14px;
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
}
</style>
