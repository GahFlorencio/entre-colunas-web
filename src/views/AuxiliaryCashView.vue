<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  reactive,
  ref,
  watch,
} from "vue";
import { useRoute } from "vue-router";
import { Funnel, Plus, FileDown } from "@lucide/vue";
import { token, lodgeId, lodge } from "@/lib/session";
import { useQuery } from "@/lib/query";
import { money, message } from "@/lib/format";
import { financialWrite, pendingWrite, writeBusy } from "@/lib/financial-write";
import {
  getCash,
  cashNames,
  kindNames,
  type Cash,
  type CashFilters,
  type CashKind,
} from "@/domain/auxiliary-cash/api";
import MovementList from "@/components/MovementList.vue";
import Modal from "@/components/Modal.vue";
import Pagination from "@/components/Pagination.vue";
import QueryState from "@/components/QueryState.vue";
const viewportHeight = ref(window.visualViewport?.height ?? window.innerHeight);
const viewportTop = ref(window.visualViewport?.offsetTop ?? 0);
function updateViewport() {
  viewportHeight.value = window.visualViewport?.height ?? window.innerHeight;
  viewportTop.value = window.visualViewport?.offsetTop ?? 0;
}
onMounted(() => {
  window.visualViewport?.addEventListener("resize", updateViewport);
  window.visualViewport?.addEventListener("scroll", updateViewport);
});
onBeforeUnmount(() => {
  window.visualViewport?.removeEventListener("resize", updateViewport);
  window.visualViewport?.removeEventListener("scroll", updateViewport);
});
const modalStyle = computed(() => ({
  maxHeight: `${Math.max(100, viewportHeight.value - 24)}px`,
  top: `${viewportTop.value + viewportHeight.value / 2}px`,
}));
const route = useRoute();
const cash = computed<Cash>(() =>
  route.params.cash === "hospitalaria" ? "hospitalaria" : "agape",
);
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const filters = ref<CashFilters>({ from: "", to: "", kind: "" });
const draft = reactive<CashFilters>({ ...filters.value });
const page = ref(1),
  showFilters = ref(false),
  showForm = ref(false),
  exporting = ref(false),
  error = ref(""),
  success = ref("");
const form = reactive({
  kind: "expense" as CashKind,
  description: "",
  value: "",
  occurred_on: today(),
});
const source = useQuery(
  () =>
    getCash(token.value, lodgeId.value, cash.value, filters.value, page.value),
  () => [cash.value, filters.value, page.value],
);
const count = computed(
  () =>
    Number(!!filters.value.from) +
    Number(!!filters.value.to) +
    Number(!!filters.value.kind),
);
const movements = computed(() =>
  (source.data.value?.results ?? []).map((e) => ({
    key: e.id,
    description: e.description,
    value: e.value,
    direction: e.direction,
    group: e.occurred_on.split("-").reverse().join("/"),
    meta: kindNames[e.kind],
  })),
);
let origin: HTMLElement | null = null,
  generation = 0;
function remember(event: Event) {
  origin = event.currentTarget as HTMLElement;
  error.value = "";
  success.value = "";
}
async function close() {
  showFilters.value = false;
  showForm.value = false;
  error.value = "";
  await nextTick();
  origin?.focus();
}
function openFilters(event: Event) {
  remember(event);
  Object.assign(draft, filters.value);
  showFilters.value = true;
}
function openForm(event: Event) {
  remember(event);
  Object.assign(form, {
    kind: "expense",
    description: "",
    value: "",
    occurred_on: today(),
  });
  showForm.value = true;
}
function apply() {
  if (draft.from && draft.to && draft.from > draft.to) {
    error.value = "A data inicial deve ser anterior ou igual à final.";
    return;
  }
  page.value = 1;
  filters.value = { ...draft };
  void close();
}
function month() {
  const now = today();
  const [year, month] = now.split("-").map(Number);
  draft.from = `${now.slice(0, 7)}-01`;
  draft.to = `${now.slice(0, 7)}-${new Date(year!, month!, 0).getDate()}`;
}
async function save() {
  if (writeBusy.value || pendingWrite.value) return;
  error.value = "";
  const value = Number(form.value.replace(",", "."));
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    !/^\d+([.,]\d{1,2})?$/.test(form.value)
  ) {
    error.value = "Informe um valor positivo com até duas casas decimais.";
    return;
  }
  const current = generation;
  try {
    await financialWrite(
      `/lodge/${lodgeId.value}/cash/${cash.value}/movements`,
      "POST",
      {
        kind: form.kind,
        description: form.description.trim(),
        value,
        occurred_on: form.kind === "transfer" ? today() : form.occurred_on,
      },
    );
    if (generation !== current) return;
    await close();
    success.value = "Movimentação registrada.";
  } catch (e) {
    if (generation === current) error.value = message(e);
  }
}
async function exportPdf() {
  if (exporting.value) return;
  exporting.value = true;
  error.value = "";
  const current = generation;
  const context = {
    token: token.value,
    lodge: lodgeId.value,
    cash: cash.value,
    name: lodge.value?.label ?? "Loja",
    filters: { ...filters.value },
  };
  try {
    const report = await getCash(
      context.token,
      context.lodge,
      context.cash,
      context.filters,
      1,
      true,
    );
    const { buildCashPdf } = await import("@/domain/auxiliary-cash/report-pdf");
    if (generation !== current) return;
    buildCashPdf(report, context.name, context.filters).save(
      `${context.cash}-${context.filters.kind === "expense" ? "despesas" : "extrato"}.pdf`,
    );
  } catch (e) {
    if (generation === current) error.value = message(e);
  } finally {
    if (generation === current) exporting.value = false;
  }
}
watch(
  [token, lodgeId, cash],
  () => {
    generation++;
    page.value = 1;
    showFilters.value = false;
    showForm.value = false;
    error.value = "";
    success.value = "";
    exporting.value = false;
    filters.value = { from: "", to: "", kind: "" };
  },
  { flush: "sync" },
);
watch(filters, () => {
  generation++;
  exporting.value = false;
});
onBeforeUnmount(() => {
  generation++;
});
</script>
<template>
  <nav class="cash-tabs" aria-label="Caixas">
    <RouterLink to="/operacoes">Loja</RouterLink
    ><RouterLink
      to="/caixas/agape"
      :aria-current="cash === 'agape' ? 'page' : undefined"
      >Ágape</RouterLink
    ><RouterLink
      to="/caixas/hospitalaria"
      :aria-current="cash === 'hospitalaria' ? 'page' : undefined"
      >Hospitalaria</RouterLink
    >
  </nav>
  <header class="page-header">
    <h1>{{ cashNames[cash] }}</h1>
    <div class="cash-actions">
      <button
        class="secondary"
        :disabled="exporting || source.loading.value || !!source.error.value"
        @click="exportPdf"
      >
        <FileDown :size="18" aria-hidden="true" />{{
          exporting ? "Gerando…" : "PDF"
        }}</button
      ><button :disabled="writeBusy || !!pendingWrite" @click="openForm">
        <Plus :size="18" aria-hidden="true" />Novo
      </button>
    </div>
  </header>
  <p v-if="success" class="notice" role="status">{{ success }}</p>
  <p
    v-if="error && !showForm && !showFilters"
    class="notice error"
    role="alert"
  >
    {{ error }}
  </p>
  <QueryState
    :loading="source.loading.value"
    :error="source.error.value"
    @retry="source.refresh"
  >
    <template v-if="source.data.value">
      <div class="cash-summary">
        <section>
          <span>Saldo atual</span
          ><strong>{{ money(source.data.value.balance) }}</strong
          ><small>Caixa {{ cashNames[cash] }}</small>
        </section>
        <section>
          <span>Despesas nos filtros</span
          ><strong>{{ money(source.data.value.totals.expenses) }}</strong
          ><small>Sem cobrança aos membros</small>
        </section>
      </div>
    </template>
  </QueryState>
  <section class="cash-ledger">
    <header>
      <h2>Movimentações</h2>
      <button class="secondary" aria-label="Filtros" @click="openFilters">
        <Funnel :size="18" aria-hidden="true" /><span v-if="count">{{
          count
        }}</span>
      </button>
    </header>
    <p class="muted cash-context">
      {{
        filters.kind === "expense" ? "Somente despesas" : "Entradas e despesas"
      }}
      ·
      {{
        filters.from ? filters.from.split("-").reverse().join("/") : "Início"
      }}
      a
      {{
        filters.to ? filters.to.split("-").reverse().join("/") : "Sem limite"
      }}
      · Data do lançamento
    </p>
    <template v-if="source.data.value"
      ><p v-if="!movements.length" class="state">
        Nenhuma movimentação nos filtros aplicados.
      </p>
      <MovementList v-else :items="movements" /><Pagination
        v-model:page="page"
        :total="source.data.value.total"
        :per-page="20"
        :loading="source.loading.value"
    /></template>
  </section>
  <Modal
    v-if="showFilters"
    title="Filtros"
    class="cash-modal"
    :style="modalStyle"
    @close="close"
    ><form class="cash-form" @submit.prevent="apply">
      <label
        >Mostrar<select v-model="draft.kind">
          <option value="">Entradas e despesas</option>
          <option value="expense">Somente despesas</option>
        </select></label
      ><button type="button" class="secondary" @click="month">Este mês</button
      ><label>De<input v-model="draft.from" type="date" /></label
      ><label>Até<input v-model="draft.to" type="date" /></label>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <div class="cash-form-actions">
        <button
          type="button"
          class="secondary"
          @click="Object.assign(draft, { from: '', to: '', kind: '' })"
        >
          Limpar filtros</button
        ><button type="submit">Aplicar filtros</button
        ><button type="button" class="secondary" @click="close">
          Cancelar
        </button>
      </div>
    </form></Modal
  >
  <Modal
    v-if="showForm"
    :title="`Novo · ${cashNames[cash]}`"
    :busy="writeBusy"
    class="cash-modal"
    :style="modalStyle"
    @close="close"
    ><form class="cash-form" @submit.prevent="save">
      <fieldset :disabled="writeBusy || !!pendingWrite">
        <label
          >Operação<select v-model="form.kind">
            <option value="expense">Despesa</option>
            <option value="transfer">Transferência da loja</option>
            <option v-if="source.data.value?.can_open" value="opening_balance">
              Saldo inicial
            </option>
          </select></label
        >
        <p class="muted">
          {{
            form.kind === "transfer"
              ? `Debita o caixa da loja e credita ${cashNames[cash]}. Repasse manual.`
              : form.kind === "opening_balance"
                ? "Valor de abertura deste caixa. Permitido somente antes da primeira movimentação."
                : "Despesa exclusiva deste caixa, sem rateio ou vínculo com períodos."
          }}
        </p>
        <label
          >Descrição<input
            v-model="form.description"
            required
            maxlength="255" /></label
        ><label
          >Valor total (R$)<input
            v-model="form.value"
            inputmode="decimal"
            required
            placeholder="0,00" /></label
        ><label v-if="form.kind !== 'transfer'"
          >Data<input v-model="form.occurred_on" type="date" required
        /></label>
      </fieldset>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="cash-form-actions">
        <button :disabled="writeBusy || !!pendingWrite" type="submit">
          {{ writeBusy ? "Salvando…" : "Registrar" }}</button
        ><button
          class="secondary"
          type="button"
          :disabled="writeBusy"
          @click="close"
        >
          Cancelar
        </button>
      </div>
    </form></Modal
  >
</template>
<style scoped>
.cash-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 20px;
}
.cash-tabs a {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 8px 12px;
  color: var(--muted);
}
.cash-tabs a[aria-current="page"] {
  color: var(--text);
  border-bottom: 2px solid var(--gold);
  font-weight: 600;
}
.cash-actions,
.cash-form-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.cash-actions button {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cash-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  margin: 16px 0 24px;
}
.cash-summary section {
  min-width: 0;
  padding: 18px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-surface);
  display: grid;
  gap: 8px;
}
.cash-summary strong {
  font-size: clamp(20px, 4vw, 28px);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.cash-summary span,
.cash-summary small {
  color: var(--muted);
}
.cash-ledger header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.cash-ledger h2 {
  font-size: 18px;
  margin: 0;
}
.cash-context {
  font-size: 12px;
  line-height: 1.6;
}
.cash-form,
.cash-form fieldset {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.cash-form fieldset {
  border: 0;
  padding: 0;
  margin: 0;
}
.cash-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.cash-form input,
.cash-form select {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  font-size: 16px;
}
.cash-form p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}
.cash-modal {
  width: min(480px, calc(100vw - 24px));
  max-width: calc(100vw - 24px);
  max-height: calc(100dvh - 24px);
  margin: 0 auto;
  bottom: auto;
  transform: translateY(-50%);
  box-sizing: border-box;
}
.cash-form-actions button {
  flex: 1 1 auto;
  min-height: 44px;
}
@media (min-width: 600px) {
  .cash-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
