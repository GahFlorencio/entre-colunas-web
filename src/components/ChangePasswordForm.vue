<script setup lang="ts">
import { reactive, ref } from "vue";
import { changePassword } from "@/domain/auth/api";
import { token } from "@/lib/session";
import { message } from "@/lib/format";
const form = reactive({ current: "", password: "", confirmation: "" });
const busy = ref(false),
  error = ref(""),
  success = ref("");
async function save() {
  if (busy.value) return;
  error.value = "";
  success.value = "";
  if (form.password !== form.confirmation) {
    error.value = "A confirmação não corresponde à nova senha.";
    return;
  }
  if (new TextEncoder().encode(form.password).length > 72) {
    error.value =
      "A nova senha deve ter no máximo 72 bytes. Acentos e símbolos podem ocupar mais de um byte.";
    return;
  }
  busy.value = true;
  try {
    await changePassword(token.value, form.current, form.password);
    form.current = form.password = form.confirmation = "";
    success.value = "Senha alterada com sucesso.";
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="section" aria-labelledby="password-heading">
    <div class="section-head"><h2 id="password-heading">Alterar senha</h2></div>
    <form class="section-body" @submit.prevent="save">
      <p id="password-help" class="muted">
        Use uma nova senha com pelo menos 8 caracteres e no máximo 72 bytes.
      </p>
      <div class="form-grid">
        <label
          >Senha atual<input
            v-model="form.current"
            name="current-password"
            type="password"
            autocomplete="current-password"
            required
            maxlength="72"
            :disabled="busy"
        /></label>
        <label
          >Nova senha<input
            v-model="form.password"
            name="new-password"
            type="password"
            autocomplete="new-password"
            required
            minlength="8"
            maxlength="72"
            aria-describedby="password-help"
            :disabled="busy"
        /></label>
        <label
          >Confirmar nova senha<input
            v-model="form.confirmation"
            name="confirm-password"
            type="password"
            autocomplete="new-password"
            required
            minlength="8"
            maxlength="72"
            :disabled="busy"
        /></label>
      </div>
      <p v-if="error" class="alert" role="alert">{{ error }}</p>
      <p v-if="success" class="success-message" role="status">{{ success }}</p>
      <div class="form-actions">
        <button :disabled="busy">
          {{ busy ? "Alterando…" : "Alterar senha" }}
        </button>
      </div>
    </form>
  </section>
</template>
