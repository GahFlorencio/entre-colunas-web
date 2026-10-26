<script setup lang="ts">
import { ref } from "vue";
import { Plus, ChevronRight } from "@lucide/vue";
import { token, lodgeId } from "@/lib/session";
import { date, label, message } from "@/lib/format";
import { useQuery } from "@/lib/query";
import {
  listFinancialPeriods,
  openFinancialPeriod,
} from "@/domain/financial-periods/api";
import QueryState from "@/components/QueryState.vue";
import Pagination from "@/components/Pagination.vue";
import Modal from "@/components/Modal.vue";
const page = ref(1),
  status = ref<"" | "open" | "closed">(""),
  opening = ref(false),
  busy = ref(false),
  error = ref("");
const query = useQuery(
  () =>
    listFinancialPeriods(token.value, lodgeId.value, {
      page: page.value,
      perPage: 20,
      status: status.value || undefined,
    }),
  () => [page.value, status.value],
);
async function open() {
  busy.value = true;
  error.value = "";
  try {
    await openFinancialPeriod(token.value, lodgeId.value);
    opening.value = false;
    page.value = 1;
    await query.refresh();
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="page-header">
    <div>
      <p class="eyebrow">CICLOS DA LOJA</p>
      <h1>Períodos financeiros</h1>
      <p>Acompanhe cada ciclo, da abertura ao fechamento.</p>
    </div>
    <button @click="opening = true">
      <Plus aria-hidden="true" :size="18" />Abrir período
    </button>
  </div>
  <div class="toolbar">
    <label style="max-width: 280px"
      >Situação<select v-model="status" @change="page = 1">
        <option value="">Todos os períodos</option>
        <option value="open">Abertos</option>
        <option value="closed">Fechados</option>
      </select></label
    >
  </div>
  <section class="section">
    <QueryState
      :loading="query.loading.value"
      :error="query.error.value"
      :empty="!query.data.value?.results.length"
      @retry="query.refresh"
      ><RouterLink
        v-for="p in query.data.value?.results"
        :key="p.id"
        :to="`/periodos/${p.id}`"
        class="row row-link"
        ><div>
          <span class="row-title">Período {{ p.sequence }}</span
          ><span class="row-meta"
            >Aberto em {{ date(p.opened_at) }} ·
            {{ p.captured_members }} membros</span
          >
        </div>
        <div class="row-main">
          <span :class="['badge', { success: p.status === 'open' }]">{{
            label(p.status)
          }}</span
          ><ChevronRight
            aria-hidden="true"
            :size="16"
          /></div></RouterLink></QueryState
    ><Pagination
      v-if="query.data.value"
      v-model:page="page"
      :total="query.data.value.total"
    />
  </section>
  <Modal
    v-if="opening"
    title="Abrir período financeiro"
    :busy="busy"
    @close="opening = false"
    ><p>
      Ao abrir o período, a API captura o quadro de membros elegíveis. Só pode
      haver um período aberto por loja.
    </p>
    <p v-if="error" class="alert" role="alert">{{ error }}</p>
    <div class="form-actions">
      <button class="secondary" :disabled="busy" @click="opening = false">
        Cancelar</button
      ><button :disabled="busy" @click="open">
        {{ busy ? "Abrindo…" : "Confirmar abertura" }}
      </button>
    </div></Modal
  >
</template>
