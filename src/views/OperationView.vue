<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";
import { ArrowLeft } from "@lucide/vue";
import { token, lodgeId } from "@/lib/session";
import { money, date, label, message } from "@/lib/format";
import { useQuery } from "@/lib/query";
import { getFinancialOperation } from "@/domain/financial-operations/api";
import { financialWrite, lodgePath } from "@/lib/financial-write";
import QueryState from "@/components/QueryState.vue";
import Modal from "@/components/Modal.vue";
const id = String(useRoute().params.id),
  reversing = ref(false),
  busy = ref(false),
  error = ref(""),
  description = ref(""),
  justification = ref(""),
  success = ref("");
const query = useQuery(() =>
  getFinancialOperation(token.value, lodgeId.value, id),
);
async function reverse() {
  busy.value = true;
  error.value = "";
  try {
    await financialWrite(
      lodgePath(`/financial/operations/${encodeURIComponent(id)}/reversals`),
      "POST",
      {
        description: description.value.trim(),
        justification: justification.value.trim(),
      },
    );
    reversing.value = false;
    success.value = "Estorno registrado com sucesso.";
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <RouterLink class="back-link" to="/operacoes"
    ><ArrowLeft aria-hidden="true" :size="16" />Voltar ao caixa</RouterLink
  ><QueryState
    :loading="query.loading.value"
    :error="query.error.value"
    @retry="query.refresh"
    ><template v-if="query.data.value"
      ><div class="page-header">
        <div>
          <p class="eyebrow">OPERAÇÃO #{{ id }}</p>
          <h1>{{ query.data.value.description }}</h1>
          <p>
            {{ label(query.data.value.type) }} ·
            {{ date(query.data.value.created_at) }}
          </p>
        </div>
        <button
          v-if="query.data.value.type !== 'reversal'"
          class="secondary"
          @click="reversing = true"
        >
          Registrar estorno
        </button>
      </div>
      <p v-if="success" class="success-message" role="status">{{ success }}</p>
      <section class="section">
        <div class="section-head">
          <h2>Movimentos da operação</h2>
          <RouterLink
            v-if="query.data.value.member_id"
            :to="`/membros/${query.data.value.member_id}`"
            class="text-button"
            >Ver membro</RouterLink
          >
        </div>
        <div
          v-for="entry in query.data.value.entries"
          :key="entry.id"
          class="row"
        >
          <div>
            <span class="row-title">{{ entry.description }}</span
            ><span class="row-meta"
              >Conta #{{ entry.financial_account_id }} ·
              {{ entry.category_label || "Sem categoria" }} · Movimento #{{
                entry.id
              }}</span
            >
          </div>
          <div class="row-end">
            <strong
              :class="entry.direction === 'credit' ? 'positive' : 'negative'"
              >{{ money(entry.value) }}</strong
            ><span class="row-meta">{{ label(entry.direction) }}</span>
          </div>
        </div>
      </section></template
    ></QueryState
  ><Modal
    v-if="reversing"
    title="Registrar estorno"
    :busy="busy"
    @close="reversing = false"
    ><form @submit.prevent="reverse">
      <p class="notice">
        O estorno cria um novo registro e preserva o histórico da operação
        original.
      </p>
      <p v-if="error" class="alert" role="alert">{{ error }}</p>
      <div class="form-grid">
        <label class="full"
          >Descrição<input
            v-model="description"
            required
            maxlength="255"
            :disabled="busy" /></label
        ><label class="full"
          >Justificativa<textarea
            v-model="justification"
            required
            :disabled="busy"
          />
        </label>
      </div>
      <div class="form-actions">
        <button
          type="button"
          class="secondary"
          :disabled="busy"
          @click="reversing = false"
        >
          Cancelar</button
        ><button :disabled="busy">
          {{ busy ? "Registrando…" : "Confirmar estorno" }}
        </button>
      </div>
    </form></Modal
  >
</template>
