<script setup lang="ts">
import { reactive, ref, computed } from "vue";
import { token, lodgeId } from "@/lib/session";
import { message } from "@/lib/format";
import { allCategories, allEligibleMembers } from "@/lib/catalogs";
import { useQuery } from "@/lib/query";

import { financialWrite, lodgePath } from "@/lib/financial-write";
import Modal from "./Modal.vue";
const props = defineProps<{ memberId?: string; initialType?: string }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const busy = ref(false),
  error = ref("");
const form = reactive({
  type:
    props.memberId || props.initialType === "payment" ? "payment" : "income",
  member_id: props.memberId || "",
  value: "",
  description: "",
  expense_category_id: "",
  kind: "adjustment",
  direction: "credit",
  justification: "",
  source_entry_id: "",
});
const categories = useQuery(() => allCategories(token.value, lodgeId.value));
const members = useQuery(() => allEligibleMembers(token.value, lodgeId.value));
const needsMember = computed(
  () => form.type === "payment" || form.type === "member-adjustment",
);
async function save() {
  busy.value = true;
  error.value = "";
  try {
    const base = {
      value: Number(form.value),
      description: form.description.trim(),
    };
    if (!Number.isFinite(base.value) || base.value <= 0)
      throw new Error("Informe um valor maior que zero.");
    let path: string, body: unknown;
    if (form.type === "income") {
      path = "/financial/incomes";
      body = { ...base, expense_category_id: form.expense_category_id };
    } else if (form.type === "payment") {
      path = `/member/${encodeURIComponent(form.member_id)}/financial/payments`;
      body = base;
    } else {
      path =
        form.type === "member-adjustment"
          ? `/member/${encodeURIComponent(form.member_id)}/financial/adjustments`
          : "/financial/adjustments";
      body = {
        ...base,
        kind: form.kind,
        direction: form.direction,
        justification: form.justification.trim(),
        ...(form.source_entry_id
          ? { source_entry_id: form.source_entry_id }
          : {}),
      };
    }
    await financialWrite(lodgePath(path), "POST", body);
    emit("saved");
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <Modal title="Registrar operação" :busy="busy" @close="emit('close')"
    ><form @submit.prevent="save">
      <p v-if="error" class="alert" role="alert">{{ error }}</p>
      <fieldset :disabled="busy" style="border: 0; padding: 0; margin: 0">
        <div class="form-grid">
          <label class="full"
            >Tipo de operação<select v-model="form.type">
              <option value="income">Entrada da loja</option>
              <option value="payment">Pagamento de membro</option>
              <option value="lodge-adjustment">Ajuste da loja</option>
              <option value="member-adjustment">Ajuste de membro</option>
            </select></label
          ><label v-if="needsMember" class="full"
            >Membro
            <select v-model="form.member_id" required :disabled="!!memberId">
              <option value="" disabled>Selecione o membro</option>
              <option
                v-if="
                  memberId &&
                  !members.data.value?.results.some((m) => m.id === memberId)
                "
                :value="memberId"
              >
                Membro #{{ memberId }}
              </option>
              <option
                v-for="m in members.data.value?.results"
                :key="m.id"
                :value="m.id"
              >
                {{ m.name }}
              </option>
            </select></label
          ><label class="full"
            >Descrição<input
              v-model="form.description"
              required
              maxlength="255" /></label
          ><label
            >Valor (R$)<input
              v-model="form.value"
              type="number"
              min="0.01"
              step="0.01"
              inputmode="decimal"
              required /></label
          ><label v-if="form.type === 'income'"
            >Categoria<select v-model="form.expense_category_id" required>
              <option value="" disabled>Selecione</option>
              <option
                v-for="c in categories.data.value?.results"
                :key="c.id"
                :value="c.id"
              >
                {{ c.label }}
              </option>
            </select></label
          ><template v-if="form.type.includes('adjustment')"
            ><label
              >Natureza<select v-model="form.kind">
                <option value="adjustment">Ajuste</option>
                <option value="opening_balance">Saldo inicial</option>
              </select></label
            ><label
              >Direção<select v-model="form.direction">
                <option value="credit">Crédito</option>
                <option value="debit">Débito</option>
              </select></label
            ><label
              >Movimento de origem (opcional)<input
                v-model="form.source_entry_id"
                inputmode="numeric"
                pattern="[1-9][0-9]*" /></label
            ><label class="full"
              >Justificativa<textarea
                v-model="form.justification"
                required
              /></label
          ></template>
        </div>
      </fieldset>
      <p
        v-if="categories.error.value || members.error.value"
        class="alert"
        role="alert"
      >
        {{ categories.error.value || members.error.value }}
      </p>
      <div class="form-actions">
        <button
          class="secondary"
          type="button"
          :disabled="busy"
          @click="emit('close')"
        >
          Cancelar</button
        ><button :disabled="busy">
          {{ busy ? "Registrando…" : "Registrar operação" }}
        </button>
      </div>
    </form></Modal
  >
</template>
