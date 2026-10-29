<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute } from "vue-router";
import { ArrowLeft, Pencil } from "@lucide/vue";
import { token, lodgeId } from "@/lib/session";
import { money, label, message } from "@/lib/format";
import { useQuery } from "@/lib/query";
import {
  getExpense,
  getFinancialPeriod,
  updateExpensePayed,
} from "@/domain/expenses/api";
import {
  getExpenseActions,
  scheduledInstallmentNumbers,
} from "@/domain/expenses/rules";
import { financialWrite, lodgePath } from "@/lib/financial-write";
import QueryState from "@/components/QueryState.vue";
import ExpenseForm from "@/components/ExpenseForm.vue";
import Modal from "@/components/Modal.vue";
const id = String(useRoute().params.id),
  edit = ref(false),
  cancelling = ref(false),
  busy = ref(false),
  error = ref(""),
  description = ref(""),
  justification = ref(""),
  selected = ref<number[]>([]);
const query = useQuery(async () => {
  const expense = await getExpense(token.value, lodgeId.value, id);
  const period = await getFinancialPeriod(
    token.value,
    lodgeId.value,
    expense.financial_period_id,
  );
  return { expense, period };
});
const actions = computed(() =>
  query.data.value
    ? getExpenseActions(
        query.data.value.expense,
        query.data.value.period.status,
      )
    : null,
);
const numbers = computed(() =>
  scheduledInstallmentNumbers(query.data.value?.expense.installments || []),
);
async function togglePaid() {
  if (!query.data.value) return;
  busy.value = true;
  error.value = "";
  try {
    await updateExpensePayed(
      token.value,
      lodgeId.value,
      id,
      !query.data.value.expense.payed,
    );
    await query.refresh();
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}
async function cancel() {
  busy.value = true;
  error.value = "";
  try {
    if (
      query.data.value?.expense.expense_type_slug !== "geral" &&
      !selected.value.length
    )
      throw new Error("Selecione ao menos uma parcela programada.");
    await financialWrite(
      lodgePath(`/expense/${encodeURIComponent(id)}/cancellation`),
      "POST",
      {
        description: description.value.trim(),
        justification: justification.value.trim(),
        ...(query.data.value?.expense.expense_type_slug !== "geral"
          ? { installment_numbers: selected.value }
          : {}),
      },
    );
    cancelling.value = false;
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <RouterLink class="back-link" to="/despesas"
    ><ArrowLeft aria-hidden="true" :size="16" />Todas as despesas</RouterLink
  >
  <p v-if="error && !cancelling" class="alert" role="alert">{{ error }}</p>
  <QueryState
    :loading="query.loading.value"
    :error="query.error.value"
    @retry="query.refresh"
    ><template v-if="query.data.value"
      ><div class="page-header">
        <div>
          <p class="eyebrow">DESPESA #{{ id }}</p>
          <h1>{{ query.data.value.expense.label }}</h1>
          <p>{{ label(query.data.value.expense.status) }}</p>
        </div>
        <button
          v-if="actions?.editDescription"
          class="secondary"
          @click="edit = true"
        >
          <Pencil aria-hidden="true" :size="16" />Corrigir despesa
        </button>
      </div>
      <section class="section section-body">
        <dl class="details">
          <div>
            <dt>Valor total original</dt>
            <dd>{{ money(query.data.value.expense.total_value) }}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{{ query.data.value.expense.expense_type_slug }}</dd>
          </div>
          <div>
            <dt>Categoria</dt>
            <dd>{{ query.data.value.expense.expense_category_slug }}</dd>
          </div>
          <div>
            <dt>Pagamento</dt>
            <dd>{{ query.data.value.expense.payed ? "Paga" : "A pagar" }}</dd>
          </div>
          <div>
            <dt>Período de origem</dt>
            <dd>
              <RouterLink :to="`/periodos/${query.data.value.period.id}`"
                >Período {{ query.data.value.period.sequence }}</RouterLink
              >
            </dd>
          </div>
          <div>
            <dt>Versão da programação</dt>
            <dd>{{ query.data.value.expense.programming_version }}</dd>
          </div>
        </dl>
        <div class="form-actions">
          <button class="secondary" :disabled="busy" @click="togglePaid">
            {{
              query.data.value.expense.payed
                ? "Marcar como não paga"
                : "Marcar como paga"
            }}</button
          ><button
            v-if="actions?.cancelGeneral || actions?.cancelScheduled"
            class="secondary"
            @click="
              cancelling = true;
              error = '';
              selected = [...numbers];
            "
          >
            Cancelar despesa / parcelas
          </button>
        </div>
      </section>
      <section class="section">
        <div class="section-head"><h2>Programação das parcelas</h2></div>
        <div
          v-for="i in query.data.value.expense.installments"
          :key="i.id"
          class="row"
        >
          <div>
            <span class="row-title">Parcela {{ i.number }}</span
            ><span class="row-meta"
              >Período {{ i.target_period_sequence }} ·
              {{ label(i.status) }}</span
            >
          </div>
          <strong>{{ money(i.value) }}</strong>
        </div>
        <div v-if="!query.data.value.expense.installments.length" class="state">
          Sem parcelas programadas.
        </div>
      </section>
      <ExpenseForm
        v-if="edit"
        :expense="query.data.value.expense"
        :structure-allowed="actions?.editStructure"
        @close="edit = false"
        @saved="edit = false" /></template></QueryState
  ><Modal
    v-if="cancelling"
    title="Cancelar despesa ou parcelas"
    :busy="busy"
    @close="cancelling = false"
    ><form @submit.prevent="cancel">
      <p class="notice">
        O cancelamento preserva o histórico e exige uma justificativa.
      </p>
      <p v-if="error" class="alert" role="alert">{{ error }}</p>
      <fieldset :disabled="busy" style="border: 0; padding: 0">
        <label v-for="n in numbers" :key="n" class="checkbox"
          ><input v-model="selected" type="checkbox" :value="n" />Cancelar
          parcela {{ n }}</label
        >
        <div class="form-grid" style="margin-top: 20px">
          <label class="full"
            >Descrição<input
              v-model="description"
              required
              maxlength="255" /></label
          ><label class="full"
            >Justificativa<textarea v-model="justification" required />
          </label>
        </div>
      </fieldset>
      <div class="form-actions">
        <button
          type="button"
          class="secondary"
          :disabled="busy"
          @click="cancelling = false"
        >
          Voltar</button
        ><button :disabled="busy">
          {{ busy ? "Cancelando…" : "Confirmar cancelamento" }}
        </button>
      </div>
    </form></Modal
  >
</template>
