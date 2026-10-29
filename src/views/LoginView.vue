<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "@lucide/vue";
import { signIn, sessionNotice } from "@/lib/session";
import { message } from "@/lib/format";
const email = ref(""),
  password = ref(""),
  visible = ref(false),
  busy = ref(false),
  error = ref("");
const router = useRouter();
async function submit() {
  busy.value = true;
  error.value = "";
  try {
    await signIn(email.value.trim(), password.value);
    password.value = "";
    await router.replace("/");
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="login-layout">
    <section class="login-story">
      <div class="brand">
        <img src="/logo-dark.png" width="52" height="52" alt="" /><span
          >ENTRE COLUNAS<small>GESTÃO & FRATERNIDADE</small></span
        >
      </div>
      <div class="story-content">
        <h1>Gestão da loja,<br />em um só lugar.</h1>
        <p>Acompanhe membros, despesas e períodos financeiros.</p>
      </div>
      <span class="story-footer">Entre Colunas · Gestão da sua loja</span>
    </section>
    <section class="login-form-wrap">
      <form class="login-form" @submit.prevent="submit">
        <img
          class="login-mark"
          src="/logo-light.png"
          alt="Entre Colunas"
          width="76"
          height="76"
        />
        <h2>Acesse sua conta</h2>
        <p class="muted">Use o e-mail cadastrado pela administração.</p>
        <p v-if="error || sessionNotice" class="alert" role="alert">
          {{ error || sessionNotice }}
        </p>
        <label
          >E-mail<input
            v-model="email"
            type="email"
            name="email"
            autocomplete="username"
            placeholder="seu@email.com"
            required
            maxlength="255"
            :disabled="busy" /></label
        ><label
          >Senha
          <div class="password-field">
            <input
              v-model="password"
              :type="visible ? 'text' : 'password'"
              name="password"
              autocomplete="current-password"
              placeholder="Digite sua senha"
              required
              maxlength="72"
              :disabled="busy"
            /><button
              type="button"
              class="icon-button"
              :aria-label="visible ? 'Ocultar senha' : 'Mostrar senha'"
              @click="visible = !visible"
            >
              <EyeOff aria-hidden="true" v-if="visible" :size="20" /><Eye
                aria-hidden="true"
                v-else
                :size="20"
              />
            </button></div></label
        ><button class="primary login-submit" :disabled="busy">
          {{ busy ? "Entrando…" : "Entrar na minha conta"
          }}<ArrowRight aria-hidden="true" :size="18" />
        </button>
        <p class="secure-note">
          <ShieldCheck aria-hidden="true" :size="16" /> Acesso exclusivo para
          contas autorizadas.
        </p>
        <div class="login-help">
          Precisa de acesso? <span>Fale com o administrador da sua loja.</span>
        </div>
      </form>
      <small class="login-copyright">Entre Colunas · Gestão da loja</small>
    </section>
  </div>
</template>
