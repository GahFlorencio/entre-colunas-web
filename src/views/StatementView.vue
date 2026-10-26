<script setup lang="ts">
import { ref } from "vue";
import { token, lodgeId } from "@/lib/session";
import { money, date, label } from "@/lib/format";
import { useQuery } from "@/lib/query";
import { listLodgeFinancialMovements } from "@/domain/lodge-financial/api";
import { listMemberAccountMovements } from "@/domain/member-account/api";
import { writeVersion } from "@/lib/financial-write";
import QueryState from "@/components/QueryState.vue";
import Pagination from "@/components/Pagination.vue";
const props = defineProps<{ memberId?: string; embedded?: boolean }>();
const page = ref(1),
  from = ref(""),
  to = ref("");
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
</script>
<template>
  <div v-if="!embedded" class="page-header">
    <div>
      <p class="eyebrow">HISTÓRICO DA CONTA</p>
      <h1>Extrato da loja</h1>
      <p>Consulte os movimentos e o saldo contábil global.</p>
    </div>
  </div>
  <h2 v-else>Extrato do membro</h2>
  <div class="toolbar">
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
  <section class="section">
    <div class="section-head">
      <h2>{{ memberId ? "Conta do membro" : "Conta da loja" }}</h2>
      <div class="row-end">
        <small class="muted">Saldo global da conta</small
        ><strong style="display: block; margin-top: 4px">{{
          money(query.data.value?.balance)
        }}</strong>
      </div>
    </div>
    <QueryState
      :loading="query.loading.value"
      :error="query.error.value"
      :empty="!query.data.value?.results.length"
      @retry="query.refresh"
      ><RouterLink
        v-for="m in query.data.value?.results"
        :key="m.id"
        :to="`/operacoes/${m.financial_operation_id}`"
        class="row row-link"
        ><div>
          <span class="row-title">{{ m.description }}</span
          ><span class="row-meta"
            >{{ date(m.created_at) }} · {{ label(m.operation_type) }} ·
            {{ m.category_label || "Sem categoria" }}</span
          >
        </div>
        <div class="row-end">
          <strong :class="m.direction === 'credit' ? 'positive' : 'negative'"
            >{{ m.direction === "credit" ? "+" : "−" }}
            {{ money(m.value) }}</strong
          ><span class="row-meta">{{ label(m.direction) }}</span>
        </div></RouterLink
      ></QueryState
    ><Pagination
      v-if="query.data.value"
      v-model:page="page"
      :total="query.data.value.total"
    />
  </section>
  <p class="muted" style="font-size: 12px; margin-bottom: 24px">
    O saldo é global e não se limita às datas ou à página exibida.
    {{
      !memberId
        ? "O saldo contábil pode diferir do caixa administrativo da visão geral."
        : ""
    }}
  </p>
</template>
