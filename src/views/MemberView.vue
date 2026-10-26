<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Pencil, Archive } from "@lucide/vue";
import { token, lodgeId } from "@/lib/session";
import { date, message } from "@/lib/format";
import { getMember, archiveMember, deleteMember } from "@/domain/members/api";
import { useQuery } from "@/lib/query";
import QueryState from "@/components/QueryState.vue";
import MemberForm from "@/components/MemberForm.vue";
import Modal from "@/components/Modal.vue";
import MemberPeriods from "@/components/MemberPeriods.vue";
import StatementView from "./StatementView.vue";
import OperationForm from "@/components/OperationForm.vue";
const route = useRoute(),
  router = useRouter(),
  edit = ref(false),
  confirmation = ref(""),
  busy = ref(false),
  error = ref(""),
  payment = ref(false);
const id = String(route.params.id);
const query = useQuery(() => getMember(token.value, lodgeId.value, id));
async function act() {
  busy.value = true;
  error.value = "";
  try {
    if (confirmation.value === "archive")
      await archiveMember(token.value, lodgeId.value, id);
    else await deleteMember(token.value, lodgeId.value, id);
    await router.replace("/membros");
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <RouterLink to="/membros" class="back-link"
    ><ArrowLeft aria-hidden="true" :size="16" />Todos os membros</RouterLink
  ><QueryState
    :loading="query.loading.value"
    :error="query.error.value"
    @retry="query.refresh"
    ><template v-if="query.data.value"
      ><div class="page-header">
        <div>
          <p class="eyebrow">PERFIL DO MEMBRO</p>
          <h1>{{ query.data.value.name }}</h1>
          <p>{{ query.data.value.status.label }}</p>
        </div>
        <button class="secondary" @click="edit = true">
          <Pencil aria-hidden="true" :size="16" />Editar membro
        </button>
      </div>
      <section class="section section-body">
        <dl class="details">
          <div>
            <dt>Telefone</dt>
            <dd>{{ query.data.value.phone || "Não informado" }}</dd>
          </div>
          <div>
            <dt>Ingresso na loja</dt>
            <dd>{{ date(query.data.value.lodge_beggin) }}</dd>
          </div>
          <div>
            <dt>Ágape</dt>
            <dd>
              {{
                query.data.value.agape_participant
                  ? "Participante"
                  : "Não participante"
              }}
            </dd>
          </div>
          <div>
            <dt>Identificador</dt>
            <dd>#{{ id }}</dd>
          </div>
        </dl>
        <div class="form-actions">
          <button class="secondary" @click="confirmation = 'archive'">
            <Archive aria-hidden="true" :size="16" />Arquivar membro</button
          ><button class="secondary" @click="confirmation = 'delete'">
            Excluir membro</button
          ><button @click="payment = true">Registrar pagamento</button>
        </div>
      </section>
      <StatementView :member-id="id" embedded /><MemberPeriods
        :member-id="id" /><MemberForm
        v-if="edit"
        :member="query.data.value"
        @close="edit = false"
        @saved="
          edit = false;
          query.refresh();
        " /><OperationForm
        v-if="payment"
        :member-id="id"
        @close="payment = false"
        @saved="
          payment = false;
          query.refresh();
        " /></template></QueryState
  ><Modal
    v-if="confirmation"
    :title="confirmation === 'archive' ? 'Arquivar membro?' : 'Excluir membro?'"
    :busy="busy"
    @close="confirmation = ''"
    ><p>
      {{
        confirmation === "archive"
          ? "O membro sairá do quadro ativo. O histórico financeiro será preservado."
          : "A exclusão é permanente e poderá ser recusada pela API se houver vínculos financeiros. Confira o membro antes de continuar."
      }}
    </p>
    <p v-if="error" class="alert" role="alert">{{ error }}</p>
    <div class="form-actions">
      <button class="secondary" :disabled="busy" @click="confirmation = ''">
        Cancelar</button
      ><button class="danger" :disabled="busy" @click="act">
        {{ busy ? "Processando…" : "Confirmar" }}
      </button>
    </div></Modal
  >
</template>
