<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Plus, ChevronRight } from "@lucide/vue";
import { token, lodgeId } from "@/lib/session";
import { initials } from "@/lib/format";
import { listMembers, listMemberStatuses } from "@/domain/members/api";
import { useQuery } from "@/lib/query";
import QueryState from "@/components/QueryState.vue";
import Pagination from "@/components/Pagination.vue";
import MemberForm from "@/components/MemberForm.vue";
const route = useRoute(),
  router = useRouter(),
  page = ref(1),
  status = ref(""),
  search = ref(""),
  showForm = ref(route.query.novo === "1");
const query = useQuery(
  () =>
    listMembers(token.value, lodgeId.value, {
      page: page.value,
      perPage: 20,
      statuses: status.value ? [status.value] : undefined,
    }),
  () => [page.value, status.value],
);
const statuses = useQuery(() => listMemberStatuses(token.value));
const visible = computed(
  () =>
    query.data.value?.results.filter((m) =>
      m.name
        .toLocaleLowerCase("pt-BR")
        .includes(search.value.toLocaleLowerCase("pt-BR")),
    ) || [],
);
function close() {
  showForm.value = false;
  void router.replace({ query: {} });
}
</script>
<template>
  <div class="page-header">
    <div>
      <p class="eyebrow">QUADRO DA LOJA</p>
      <h1>Membros</h1>
      <p>Pessoas que constroem a nossa história.</p>
    </div>
    <button @click="showForm = true">
      <Plus aria-hidden="true" :size="18" />Cadastrar membro
    </button>
  </div>
  <div class="toolbar">
    <label class="search"
      >Buscar nesta página<input
        v-model="search"
        type="search"
        placeholder="Nome do membro" /></label
    ><label
      >Situação<select v-model="status" @change="page = 1">
        <option value="">Todas as situações</option>
        <option
          v-for="s in statuses.data.value || []"
          :value="s.slug"
          :key="s.id"
        >
          {{ s.label }}
        </option>
      </select></label
    >
  </div>
  <section class="section">
    <div class="section-head">
      <h2>Quadro de membros</h2>
      <span class="muted" style="font-size: 12px"
        >{{ query.data.value?.total ?? "—" }} cadastrados</span
      >
    </div>
    <QueryState
      :loading="query.loading.value"
      :error="query.error.value"
      :empty="!visible.length"
      @retry="query.refresh"
      ><RouterLink
        v-for="m in visible"
        :key="m.id"
        :to="`/membros/${m.id}`"
        class="row row-link"
        ><div class="row-main">
          <span class="avatar">{{ initials(m.name) }}</span>
          <div>
            <span class="row-title">{{ m.name }}</span
            ><span class="row-meta"
              >{{ m.phone || "Sem telefone" }} ·
              {{
                m.agape_participant ? "Participa do ágape" : "Sem ágape"
              }}</span
            >
          </div>
        </div>
        <div class="row-main">
          <span :class="['badge', { success: m.status.slug === 'ativo' }]">{{
            m.status.label
          }}</span
          ><ChevronRight
            aria-hidden="true"
            :size="16"
            class="muted"
          /></div></RouterLink></QueryState
    ><Pagination
      v-if="query.data.value"
      v-model:page="page"
      :total="query.data.value.total"
      :loading="query.loading.value"
    />
  </section>
  <MemberForm
    v-if="showForm"
    @close="close"
    @saved="
      close();
      query.refresh();
    "
  />
</template>
