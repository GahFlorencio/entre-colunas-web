<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import { token, lodgeId } from "@/lib/session";
import { money, date, label, message } from "@/lib/format";
import { useQuery } from "@/lib/query";
import {
  getFinancialPeriod,
  previewFinancialPeriod,
} from "@/domain/financial-periods/api";
import type { FinancialPeriodPreview } from "@/domain/financial-periods/types";
import { financialWrite, lodgePath } from "@/lib/financial-write";
import { readStatements, type PeriodStatement } from "@/lib/read";
import QueryState from "@/components/QueryState.vue";
import Pagination from "@/components/Pagination.vue";
import PeriodReport from "@/components/PeriodReport.vue";
import Modal from "@/components/Modal.vue";
const id = String(useRoute().params.id),
  reviewing = ref(false),
  busy = ref(false),
  error = ref(""),
  addition = ref<string | number>("0"),
  preview = ref<FinancialPeriodPreview | null>(null),
  confirmed = ref(false),
  page = ref(1),
  selected = ref<PeriodStatement | null>(null);
const query = useQuery(() =>
  getFinancialPeriod(token.value, lodgeId.value, id),
);
const statements = useQuery(
  async () =>
    query.data.value?.status === "closed"
      ? readStatements(id, page.value)
      : { results: [], total: 0, page: 1, per_page: 20 },
  () => [query.data.value?.status, page.value],
);
watch(addition, () => {
  preview.value = null;
  confirmed.value = false;
});
async function review() {
  busy.value = true;
  error.value = "";
  preview.value = null;
  confirmed.value = false;
  try {
    const result = await previewFinancialPeriod(token.value, lodgeId.value, {
      acrescimo: Number(addition.value),
    });
    if (result.financial_period_id !== id)
      throw new Error(
        "O período aberto mudou. Atualize os dados antes de continuar.",
      );
    preview.value = result;
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}
async function close() {
  if (!preview.value || preview.value.impediments.length || !confirmed.value)
    return;
  busy.value = true;
  error.value = "";
  try {
    await financialWrite(
      lodgePath(`/financial/periods/${encodeURIComponent(id)}/close`),
      "POST",
      { acrescimo: preview.value.acrescimo },
    );
    reviewing.value = false;
    preview.value = null;
    await query.refresh();
  } catch (e) {
    error.value = message(e);
    preview.value = null;
    confirmed.value = false;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <QueryState
    :loading="query.loading.value"
    :error="query.error.value"
    @retry="query.refresh"
    ><template v-if="query.data.value">
      <PeriodReport
        v-model:addition="addition"
        :period-id="id"
        :sequence="query.data.value.sequence"
        :details="query.data.value"
        :status="query.data.value.status"
      >
        <template #actions>
          <button
            v-if="query.data.value.status === 'open'"
            class="secondary period-review"
            @click="reviewing = true"
          >
            Revisar fechamento
          </button>
        </template>
        <template #details>
          <section
            class="period-metadata"
            aria-labelledby="period-details-heading"
          >
            <h2 id="period-details-heading">Detalhes do período</h2>
            <dl class="details">
              <div>
                <dt>Abertura</dt>
                <dd>{{ date(query.data.value.opened_at) }}</dd>
              </div>
              <div>
                <dt>Membros</dt>
                <dd>{{ query.data.value.captured_members }}</dd>
              </div>
              <div>
                <dt>Fechamento</dt>
                <dd>{{ date(query.data.value.closed_at) }}</dd>
              </div>
              <template v-if="query.data.value.status === 'closed'"
                ><div>
                  <dt>Contribuição</dt>
                  <dd>
                    {{ money(query.data.value.closing_contribution_value) }}
                  </dd>
                </div>
                <div>
                  <dt>Ágape</dt>
                  <dd>{{ money(query.data.value.closing_agape_value) }}</dd>
                </div>
                <div>
                  <dt>Acréscimo</dt>
                  <dd>{{ money(query.data.value.acrescimo) }}</dd>
                </div>
                <div>
                  <dt>Demonstrativos</dt>
                  <dd>{{ query.data.value.statements_count }}</dd>
                </div></template
              >
            </dl>
          </section>
        </template>
        <template #members>
          <section v-if="query.data.value.status === 'closed'" class="section">
            <div class="section-head"><h2>Demonstrativos dos membros</h2></div>
            <QueryState
              :loading="statements.loading.value"
              :error="statements.error.value"
              :empty="!statements.data.value?.results.length"
              @retry="statements.refresh"
              ><button
                v-for="s in statements.data.value?.results"
                :key="s.id"
                class="row statement-button"
                @click="selected = s"
              >
                <div>
                  <span class="row-title">{{ s.member_name }}</span
                  ><span class="row-meta">{{ s.member_status_slug }}</span>
                </div>
                <strong>{{ money(s.net_value) }}</strong>
              </button></QueryState
            ><Pagination
              v-if="statements.data.value"
              v-model:page="page"
              :total="statements.data.value.total"
            />
          </section>
          <section v-if="query.data.value.status === 'open'" class="section">
            <div class="section-head">
              <h2>Quadro capturado na abertura</h2>
            </div>
            <RouterLink
              v-for="m in query.data.value.members"
              :key="m.member_id"
              :to="`/membros/${m.member_id}`"
              class="row row-link"
              ><div>
                <span class="row-title">{{ m.member_name }}</span
                ><span class="row-meta">{{
                  m.agape_participant ? "Participa do ágape" : "Sem ágape"
                }}</span>
              </div>
              <span class="badge">{{ m.member_status_slug }}</span></RouterLink
            >
          </section>
        </template>
      </PeriodReport></template
    ></QueryState
  >
  <Modal
    v-if="reviewing"
    title="Revisar fechamento do período"
    :busy="busy"
    @close="reviewing = false"
    ><p class="notice">
      Confira as cobranças antes de fechar. O fechamento gera demonstrativos e
      abre automaticamente o próximo período.
    </p>
    <p v-if="error" class="alert" role="alert">{{ error }}</p>
    <form @submit.prevent="review">
      <label
        >Acréscimo por membro ativo (R$)<input
          v-model="addition"
          type="number"
          min="0"
          step="0.01"
          required
          :disabled="busy" /></label
      ><button class="secondary" style="margin: 16px 0" :disabled="busy">
        {{ busy ? "Processando…" : "Calcular prévia" }}
      </button>
    </form>
    <template v-if="preview"
      ><p v-if="preview.impediments.length" class="alert" role="alert">
        {{ preview.impediments.join(". ") }}
      </p>
      <div
        v-for="m in preview.results"
        :key="m.member_id"
        class="preview-member"
      >
        <strong>{{ m.member_name }}</strong
        ><span class="row-meta"
          >Saldo atual {{ money(m.current_balance) }} · Novas cobranças
          {{ money(m.new_charges) }}</span
        ><span class="row-meta"
          >Saldo projetado: {{ money(m.projected_balance) }}</span
        >
        <details>
          <summary>Ver composição</summary>
          <div
            v-for="(item, i) in m.items"
            :key="i"
            class="row"
            style="padding: 10px 0"
          >
            <span>{{ item.description }}</span
            ><span>{{ money(item.value) }}</span>
          </div>
        </details>
      </div>
      <p class="muted" style="font-size: 12px">
        Diferenças de rateio: {{ preview.differences.length }} registro(s).
      </p>
      <label class="checkbox"
        ><input
          v-model="confirmed"
          type="checkbox"
          :disabled="busy || !!preview.impediments.length"
        />Revisei os valores e confirmo o fechamento.</label
      >
      <div class="form-actions">
        <button class="secondary" :disabled="busy" @click="reviewing = false">
          Voltar</button
        ><button
          :disabled="busy || !confirmed || !!preview.impediments.length"
          @click="close"
        >
          {{ busy ? "Fechando…" : "Fechar período" }}
        </button>
      </div></template
    ></Modal
  >
  <Modal v-if="selected" :title="selected.member_name" @close="selected = null"
    ><p class="muted">Demonstrativo #{{ selected.id }}</p>
    <dl class="details">
      <div>
        <dt>Novas cobranças</dt>
        <dd>{{ money(selected.new_charges_value) }}</dd>
      </div>
      <div>
        <dt>Valor líquido</dt>
        <dd>{{ money(selected.net_value) }}</dd>
      </div>
    </dl>
    <div
      v-for="i in selected.items"
      :key="i.id"
      class="row"
      style="padding: 16px 0"
    >
      <div>
        <strong>{{ i.description }}</strong
        ><span class="row-meta"
          >{{ i.category_label || label(i.type)
          }}{{ i.divisor ? ` · Divisor ${i.divisor}` : "" }}</span
        >
      </div>
      <strong>{{ money(i.value) }}</strong>
    </div></Modal
  >
</template>

<style scoped>
.period-review {
  width: 100%;
  min-height: 44px;
  font-size: 13px;
  margin: 12px 0 0;
}
.period-metadata {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  margin: 0 0 12px;
  padding: 12px;
  font-size: 13px;
}
.period-metadata h2 {
  font-size: 12px;
  font-weight: 600;
  margin: 0 0 10px;
}
.period-metadata dl {
  padding: 0;
  margin: 0;
  gap: 12px 8px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.period-metadata dd {
  font-size: 13px;
  margin: 3px 0 0;
  font-variant-numeric: tabular-nums;
}
.period-metadata dt {
  font-size: 11px;
}
</style>
