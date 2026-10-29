<script setup lang="ts">
import { computed, nextTick, ref, onScopeDispose } from "vue";
import { token, lodgeId, lodge } from "@/lib/session";
import { money, date, label, message } from "@/lib/format";
import { useQuery } from "@/lib/query";
import { listLodgeFinancialMovements } from "@/domain/lodge-financial/api";
import { listMemberAccountMovements } from "@/domain/member-account/api";
import { writeVersion } from "@/lib/financial-write";
import MovementList from "@/components/MovementList.vue";
import QueryState from "@/components/QueryState.vue";
import { Funnel, Download } from "@lucide/vue";
import Modal from "@/components/Modal.vue";
import Pagination from "@/components/Pagination.vue";
import { collectStatementReport } from "@/domain/lodge-financial/statement-report";
const props = defineProps<{ memberId?: string; embedded?: boolean }>();
const page = ref(1),
  from = ref(""),
  to = ref("");
const filtersOpen = ref(false),
  draftFrom = ref(""),
  draftTo = ref("");
const filterButton = ref<HTMLButtonElement>();
async function closeFilters() {
  filtersOpen.value = false;
  await nextTick();
  filterButton.value?.focus();
}
const filterCount = computed(
  () => Number(Boolean(from.value)) + Number(Boolean(to.value)),
);
function openFilters() {
  draftFrom.value = from.value;
  draftTo.value = to.value;
  filtersOpen.value = true;
}
function applyFilters() {
  from.value = draftFrom.value;
  to.value = draftTo.value;
  page.value = 1;
  void closeFilters();
}
const query = useQuery<
  | Awaited<ReturnType<typeof listLodgeFinancialMovements>>
  | Awaited<ReturnType<typeof listMemberAccountMovements>>
>(
  () => {
    if (from.value && to.value && from.value > to.value)
      return Promise.reject(
        new Error("A data inicial deve ser anterior à data final."),
      );
    const options = {
      page: page.value,
      perPage: 20,
      from: from.value || undefined,
      to: to.value || undefined,
    };
    return props.memberId
      ? listMemberAccountMovements(
          token.value,
          lodgeId.value,
          props.memberId,
          options,
        )
      : listLodgeFinancialMovements(token.value, lodgeId.value, options);
  },
  () => [page.value, from.value, to.value, props.memberId, writeVersion.value],
);
const exporting = ref(false),
  exportError = ref(""),
  progress = ref("");
let alive = true;
onScopeDispose(() => {
  alive = false;
});
async function exportPdf() {
  if (
    exporting.value ||
    props.embedded ||
    props.memberId ||
    !query.data.value ||
    query.error.value ||
    query.loading.value
  )
    return;
  exporting.value = true;
  exportError.value = "";
  progress.value = "Preparando…";
  const context = {
    token: token.value,
    lodge: lodgeId.value,
    version: writeVersion.value,
    from: from.value,
    to: to.value,
    name: `${lodge.value?.label || "Loja"}${lodge.value?.number ? ` · Nº ${lodge.value.number}` : ""}`,
  };
  const assertCurrent = () => {
    if (
      !alive ||
      context.token !== token.value ||
      context.lodge !== lodgeId.value ||
      context.version !== writeVersion.value ||
      context.from !== from.value ||
      context.to !== to.value
    )
      throw new Error("Os dados ou filtros mudaram. Exporte novamente.");
  };
  try {
    const report = await collectStatementReport(
      (page) =>
        listLodgeFinancialMovements(context.token, context.lodge, {
          page,
          perPage: 100,
          from: context.from || undefined,
          to: context.to || undefined,
        }),
      assertCurrent,
      (done, total) => {
        progress.value = `${done} de ${total}`;
      },
    );
    const { downloadStatementPdf } =
      await import("@/domain/lodge-financial/statement-report-pdf");
    assertCurrent();
    downloadStatementPdf({
      ...report,
      lodgeName: context.name,
      generatedAt: new Date().toISOString(),
      from: context.from,
      to: context.to,
    });
  } catch (error) {
    if (alive) exportError.value = message(error);
  } finally {
    exporting.value = false;
    progress.value = "";
  }
}
</script>
<template>
  <div v-if="!embedded" class="page-header statement-header">
    <div>
      <h1>Extrato da loja</h1>
    </div>
    <button
      v-if="!memberId"
      class="secondary statement-pdf"
      aria-label="Exportar extrato em PDF"
      :disabled="
        exporting ||
        query.loading.value ||
        !!query.error.value ||
        !query.data.value
      "
      @click="exportPdf"
    >
      <Download :size="17" aria-hidden="true" />PDF
    </button>
  </div>
  <div v-else class="member-statement-heading">
    <h2>Movimentações</h2>
    <button
      class="secondary"
      ref="filterButton"
      aria-label="Filtrar extrato"
      @click="openFilters"
    >
      <Funnel :size="18" aria-hidden="true" />Filtros<span
        v-if="filterCount"
        class="badge"
        >{{ filterCount }}</span
      >
    </button>
  </div>
  <div v-if="!embedded" class="toolbar">
    <label
      >Data inicial<input
        v-model="from"
        type="date"
        @change="page = 1" /></label
    ><label
      >Data final<input
        v-model="to"
        type="date"
        :min="from"
        @change="page = 1" /></label
    ><button
      class="secondary"
      @click="
        from = '';
        to = '';
        page = 1;
      "
    >
      Limpar filtros
    </button>
  </div>
  <p v-if="exporting" class="export-feedback muted" role="status">
    Exportando · {{ progress }}
  </p>
  <p v-if="exportError" class="export-feedback error" role="alert">
    {{ exportError }}
  </p>
  <section :class="['section', { 'member-ledger': embedded }]">
    <div v-if="!embedded" class="section-head">
      <h2>{{ memberId ? "Conta do membro" : "Conta da loja" }}</h2>
      <div
        v-if="query.data.value && !query.error.value && !query.loading.value"
        class="row-end"
      >
        <small class="muted">Saldo global da conta</small
        ><strong style="display: block; margin-top: 4px">{{
          money(query.data.value.balance)
        }}</strong>
      </div>
    </div>
    <QueryState
      :loading="query.loading.value"
      :error="query.error.value"
      :empty="!query.data.value?.results.length"
      @retry="query.refresh"
      ><div :class="{ 'lodge-movements': !embedded }">
        <MovementList
          :items="
            (query.data.value?.results ?? []).map((m) => ({
              key: m.id,
              description: m.description,
              value: m.value,
              direction: m.direction,
              group: date(m.created_at),
              meta: (embedded
                ? [
                    date(m.created_at),
                    label(m.operation_type),
                    m.category_label,
                  ]
                : [date(m.created_at), m.category_label]
              )
                .filter(Boolean)
                .join(embedded ? ' · ' : ' - '),
              to: `/operacoes/${m.financial_operation_id}`,
            }))
          "
        />
      </div> </QueryState
    ><Pagination
      v-if="query.data.value"
      v-model:page="page"
      :total="query.data.value.total"
    />
  </section>
  <p
    v-if="!embedded"
    class="muted"
    style="font-size: 12px; margin-bottom: 24px"
  >
    O saldo é global e não se limita às datas ou à página exibida.
    {{
      !memberId
        ? "O saldo contábil pode diferir do caixa administrativo da visão geral."
        : ""
    }}
  </p>
  <Modal
    v-if="filtersOpen"
    title="Filtrar extrato"
    class="statement-filters"
    @close="closeFilters"
  >
    <form @submit.prevent="applyFilters">
      <div class="statement-date-fields">
        <label
          >Data inicial<input
            v-model="draftFrom"
            type="date"
            :max="draftTo || undefined" /></label
        ><label
          >Data final<input
            v-model="draftTo"
            type="date"
            :min="draftFrom || undefined"
        /></label>
      </div>
      <div class="statement-filter-actions">
        <button
          type="button"
          class="secondary"
          @click="
            draftFrom = '';
            draftTo = '';
          "
        >
          Limpar filtros</button
        ><button type="button" class="secondary" @click="closeFilters">
          Cancelar</button
        ><button type="submit">Aplicar filtros</button>
      </div>
    </form>
  </Modal>
</template>
<style scoped>
.statement-header {
  gap: 12px;
  align-items: center;
}
.statement-header > div {
  min-width: 0;
  flex: 1;
}
.statement-header h1 {
  font-size: 24px;
  margin: 0;
}
.statement-pdf {
  min-height: 44px;
  flex-shrink: 0;
}
.export-feedback {
  font-size: 12px;
  margin: 0 0 12px;
}
.lodge-movements {
  padding: 12px 16px 0;
}
.member-ledger {
  border: 0;
  border-radius: 0;
  background: transparent;
  overflow: visible;
}
.member-ledger :deep(.pagination) {
  padding: 16px 0;
  border-top: 0;
}

.member-statement-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.member-statement-heading h2 {
  margin: 0;
  font-size: 18px;
}
.statement-filters {
  width: calc(100% - 24px);
  max-width: 480px;
  padding: 20px;
}
.statement-date-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}
.statement-date-fields label,
.statement-date-fields input {
  min-width: 0;
  width: 100%;
}
.statement-date-fields input {
  min-height: 44px;
  font-size: 16px;
}
.statement-filter-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 20px;
}
.statement-filter-actions button {
  flex: 1 1 auto;
  min-height: 44px;
}
</style>
