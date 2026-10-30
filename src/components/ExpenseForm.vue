<script setup lang="ts">
import { reactive, ref, computed } from "vue";
import { token, lodgeId } from "@/lib/session";
import { message, money } from "@/lib/format";
import { allCategories, allEligibleMembers } from "@/lib/catalogs";
import { useQuery } from "@/lib/query";
import { listExpenseTypes } from "@/domain/expenses/api";
import {
  listFinancialPeriods,
  getFinancialPeriod,
} from "@/domain/financial-periods/api";
import type { Expense } from "@/domain/expenses/types";
import { ApiError } from "@/domain/auth/api";
import {
  buildCreateExpensePayload,
  buildExpenseCorrection,
  ExpenseRuleError,
  eligibleIndividualMembers,
} from "@/domain/expenses/rules";
import { financialWrite, lodgePath } from "@/lib/financial-write";
import QueryState from "./QueryState.vue";
import Modal from "./Modal.vue";
const props = defineProps<{ expense?: Expense; structureAllowed?: boolean }>();
const emit = defineEmits<{ close: []; saved: []; reload: [] }>();
const busy = ref(false),
  error = ref(""),
  staleRevision = ref(false);
const form = reactive({
  label: props.expense?.label || "",
  total_value: props.expense?.total_value.toString() || "",
  parcels: props.expense?.parcels || 1,
  category: props.expense?.expense_category_id || "",
  type: props.expense?.expense_type_id || "",
  ratio: props.expense?.ratio_to_all ?? false,
  member: props.expense?.owner_expense_member_id || "",
  payed: props.expense?.payed || false,
  justification: "",
});
const catalogs = useQuery(async () => {
  const [categories, types, members, periods] = await Promise.all([
    allCategories(token.value, lodgeId.value),
    listExpenseTypes(token.value, lodgeId.value),
    allEligibleMembers(token.value, lodgeId.value),
    listFinancialPeriods(token.value, lodgeId.value, {
      page: 1,
      perPage: 1,
      status: "open",
    }),
  ]);
  const openPeriod = periods.results[0];
  const captured = openPeriod
    ? await getFinancialPeriod(token.value, lodgeId.value, openPeriod.id)
    : null;
  const eligible = eligibleIndividualMembers(
    members.results,
    captured?.members,
  );
  return {
    categories,
    types,
    members: { ...members, results: eligible, total: eligible.length },
  };
});
const typeSlug = computed(
  () =>
    catalogs.data.value?.types.find((t) => t.id === form.type)?.slug ||
    props.expense?.expense_type_slug ||
    "",
);
const correctionChanges = computed(() => {
  const expense = props.expense;
  if (!expense) return [];
  const category =
    catalogs.data.value?.categories.results.find(
      (item) => item.id === form.category,
    )?.label || expense.expense_category_slug;
  const type =
    catalogs.data.value?.types.find((item) => item.id === form.type)?.label ||
    expense.expense_type_slug;
  const owner =
    catalogs.data.value?.members.results.find((item) => item.id === form.member)
      ?.name || (form.member ? `Membro #${form.member}` : "Não definido");
  const beforeOwner =
    catalogs.data.value?.members.results.find(
      (item) => item.id === expense.owner_expense_member_id,
    )?.name ||
    (expense.owner_expense_member_id
      ? `Membro #${expense.owner_expense_member_id}`
      : "Não definido");
  const changes = [
    ["Descrição", expense.label, form.label.trim()],
    [
      "Valor total original",
      money(expense.total_value),
      money(Number(form.total_value)),
    ],
    [
      "Parcelas",
      String(expense.parcels),
      String(typeSlug.value === "geral" ? 1 : form.parcels),
    ],
    ["Tipo", expense.expense_type_slug, type],
    ["Categoria", expense.expense_category_slug, category],
    [
      "Distribuição",
      expense.ratio_to_all === null
        ? "—"
        : expense.ratio_to_all
          ? "Ativos e afastados"
          : "Somente ativos",
      typeSlug.value === "rateio"
        ? form.ratio
          ? "Ativos e afastados"
          : "Somente ativos"
        : "—",
    ],
    ["Responsável", beforeOwner, typeSlug.value === "individual" ? owner : "—"],
  ];
  return changes.filter(([, before, after]) => before !== after);
});
const correctionChangesStructure = computed(() =>
  correctionChanges.value.some(([field]) => field !== "Descrição"),
);
async function save() {
  busy.value = true;
  error.value = "";
  try {
    const draft = {
      label: form.label,
      totalValueCents: Math.round(Number(form.total_value) * 100),
      parcels: form.parcels,
      categoryId: form.category,
      typeId: form.type,
      typeSlug: typeSlug.value,
      ratioToAll: form.ratio,
      ownerMemberId: form.member,
      payed: form.payed,
    };
    const body = props.expense
      ? props.structureAllowed
        ? buildExpenseCorrection(props.expense, draft, form.justification)
        : {
            label: form.label.trim(),
            justification: form.justification.trim(),
            expected_updated_at: props.expense.updated_at,
          }
      : buildCreateExpensePayload(draft);
    await financialWrite(
      lodgePath(
        props.expense
          ? `/expense/${encodeURIComponent(props.expense.id)}`
          : "/expense",
      ),
      props.expense ? "PATCH" : "POST",
      body,
    );
    emit("saved");
  } catch (e) {
    staleRevision.value = e instanceof ApiError && e.status === 409;
    error.value =
      e instanceof ExpenseRuleError
        ? Object.values(e.fields).join(" ")
        : message(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <Modal
    :title="expense ? 'Corrigir despesa' : 'Registrar despesa'"
    :busy="busy"
    @close="emit('close')"
    ><QueryState
      :loading="catalogs.loading.value"
      :error="catalogs.error.value"
      @retry="catalogs.refresh"
      ><form @submit.prevent="save">
        <p v-if="error" class="alert" role="alert">{{ error }}</p>
        <button
          v-if="staleRevision"
          class="secondary revision-reload"
          type="button"
          :disabled="busy"
          @click="emit('reload')"
        >
          Descartar correção e atualizar
        </button>
        <section
          v-if="expense"
          class="correction-review"
          aria-label="Revisão da correção"
        >
          <strong>Antes e depois</strong>
          <p v-if="!correctionChanges.length" class="muted">
            Nenhuma alteração nos campos atuais.
          </p>
          <dl v-else>
            <div
              v-for="[field, before, after] in correctionChanges"
              :key="field"
            >
              <dt>{{ field }}</dt>
              <dd>
                <span>{{ before || "—" }}</span
                ><span aria-hidden="true">→</span
                ><strong>{{ after || "—" }}</strong>
              </dd>
            </div>
          </dl>
          <p v-if="correctionChangesStructure" class="notice">
            Uma alteração estrutural gera compensação do débito atual e cria uma
            nova programação na conta da loja. Confira também as parcelas
            exibidas após salvar.
          </p>
        </section>
        <p v-if="expense && !structureAllowed" class="notice">
          Esta despesa já possui lançamentos ou cancelamentos. Você pode
          corrigir a descrição.
        </p>
        <fieldset :disabled="busy" style="border: 0; padding: 0; margin: 0">
          <div class="form-grid">
            <label class="full"
              >Descrição<input
                v-model="form.label"
                required
                maxlength="255" /></label
            ><template v-if="!expense || structureAllowed"
              ><label
                >Valor total (R$)<input
                  v-model="form.total_value"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputmode="decimal"
                  required /></label
              ><label
                >Tipo<select v-model="form.type" required>
                  <option disabled value="">Selecione</option>
                  <option
                    v-for="t in catalogs.data.value?.types"
                    :key="t.id"
                    :value="t.id"
                  >
                    {{ t.label }}
                  </option>
                </select></label
              ><label
                >Categoria<select v-model="form.category" required>
                  <option disabled value="">Selecione</option>
                  <option
                    v-if="
                      expense &&
                      !catalogs.data.value?.categories.results.some(
                        (c) => c.id === expense?.expense_category_id,
                      )
                    "
                    :value="expense.expense_category_id"
                  >
                    Categoria atual (inativa)
                  </option>
                  <option
                    v-for="c in catalogs.data.value?.categories.results"
                    :key="c.id"
                    :value="c.id"
                  >
                    {{ c.label }}
                  </option>
                </select></label
              ><label v-if="typeSlug !== 'geral'"
                >Parcelas<input
                  v-model.number="form.parcels"
                  type="number"
                  min="1"
                  max="2147483647"
                  step="1"
                  required /></label
              ><label v-if="typeSlug === 'rateio'" class="full"
                >Distribuição<select v-model="form.ratio">
                  <option :value="true">Ativos e afastados</option>
                  <option :value="false">Somente membros ativos</option>
                </select></label
              ><label v-if="typeSlug === 'individual'" class="full"
                >Responsável<select v-model="form.member" required>
                  <option value="" disabled>Selecione o membro</option>
                  <option
                    v-if="
                      expense?.owner_expense_member_id &&
                      !catalogs.data.value?.members.results.some(
                        (m) => m.id === expense?.owner_expense_member_id,
                      )
                    "
                    :value="expense.owner_expense_member_id"
                  >
                    Responsável atual #{{ expense.owner_expense_member_id }}
                  </option>
                  <option
                    v-for="m in catalogs.data.value?.members.results"
                    :value="m.id"
                    :key="m.id"
                  >
                    {{ m.name }}
                  </option>
                </select></label
              ><label v-if="!expense" class="checkbox full"
                ><input v-model="form.payed" type="checkbox" />Despesa já
                paga</label
              ></template
            ><label v-if="expense" class="full"
              >Justificativa da correção<textarea
                v-model="form.justification"
                required
              />
            </label>
          </div>
        </fieldset>
        <div class="form-actions">
          <button
            class="secondary"
            type="button"
            :disabled="busy"
            @click="emit('close')"
          >
            Cancelar</button
          ><button :disabled="busy">
            {{ busy ? "Salvando…" : "Salvar despesa" }}
          </button>
        </div>
      </form></QueryState
    ></Modal
  >
</template>
<style scoped>
.correction-review {
  margin: 0 0 16px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  background: var(--surface-subtle);
}
.correction-review > strong {
  display: block;
  margin-bottom: 10px;
}
.correction-review dl {
  margin: 0;
  display: grid;
  gap: 8px;
}
.correction-review dl > div {
  display: grid;
  grid-template-columns: minmax(90px, 0.7fr) minmax(0, 1.3fr);
  gap: 8px;
}
.correction-review dt {
  color: var(--muted);
  font-size: 12px;
}
.correction-review dd {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.correction-review dd strong {
  font-weight: 650;
}
.correction-review .notice {
  margin: 12px 0 0;
  font-size: 12px;
}
</style>
