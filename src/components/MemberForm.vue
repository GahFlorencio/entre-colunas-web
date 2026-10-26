<script setup lang="ts">
import { reactive, ref, onMounted } from "vue";
import { token, lodgeId } from "@/lib/session";
import { message } from "@/lib/format";
import {
  createMember,
  updateMember,
  listMemberStatuses,
  type Member,
  type MemberStatusOption,
} from "@/domain/members/api";
import Modal from "./Modal.vue";
const props = defineProps<{ member?: Member }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const busy = ref(false),
  error = ref(""),
  statuses = ref<MemberStatusOption[]>([]);
const form = reactive({
  name: props.member?.name ?? "",
  phone: props.member?.phone ?? "",
  agape_participant: props.member?.agape_participant ?? true,
  lodge_beggin:
    props.member?.lodge_beggin.slice(0, 10) ??
    new Date().toISOString().slice(0, 10),
  member_status_slug: props.member?.status.slug ?? "ativo",
});
onMounted(async () => {
  try {
    statuses.value = (await listMemberStatuses(token.value)).filter(
      (s) => s.active,
    );
  } catch (e) {
    error.value = message(e);
  }
});
async function save() {
  busy.value = true;
  error.value = "";
  try {
    const input = {
      ...form,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      lodge_beggin: `${form.lodge_beggin}T00:00:00.000Z`,
    };
    if (props.member)
      await updateMember(token.value, lodgeId.value, props.member.id, input);
    else await createMember(token.value, lodgeId.value, input);
    emit("saved");
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <Modal
    :title="member ? 'Editar membro' : 'Cadastrar membro'"
    :busy="busy"
    @close="emit('close')"
    ><form @submit.prevent="save">
      <p v-if="error" class="alert" role="alert">{{ error }}</p>
      <fieldset :disabled="busy" style="border: 0; padding: 0; margin: 0">
        <div class="form-grid">
          <label class="full"
            >Nome completo<input
              v-model="form.name"
              required
              maxlength="255"
              autocomplete="name" /></label
          ><label
            >Telefone<input
              v-model="form.phone"
              type="tel"
              maxlength="255"
              autocomplete="tel" /></label
          ><label
            >Ingresso na loja<input
              v-model="form.lodge_beggin"
              type="date"
              required /></label
          ><label class="full"
            >Situação<select v-model="form.member_status_slug" required>
              <option v-for="s in statuses" :key="s.id" :value="s.slug">
                {{ s.label }}
              </option>
            </select></label
          ><label class="checkbox full"
            ><input v-model="form.agape_participant" type="checkbox" />Participa
            do ágape</label
          >
        </div>
      </fieldset>
      <div class="form-actions">
        <button
          type="button"
          class="secondary"
          :disabled="busy"
          @click="emit('close')"
        >
          Cancelar</button
        ><button :disabled="busy || !statuses.length">
          {{ busy ? "Salvando…" : "Salvar membro" }}
        </button>
      </div>
    </form></Modal
  >
</template>
