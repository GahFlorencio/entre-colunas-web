<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import {
  adminOptions,
  createAdmin,
  listAdmin,
  type Resource,
  type Authority,
  type AdminLodge,
  type AdminUser,
} from "@/domain/admin/api";
import { getMe } from "@/domain/auth/api";
import { token, user, selectLodge, lodgeId } from "@/lib/session";
import { message } from "@/lib/format";
import { useQuery } from "@/lib/query";
import QueryState from "@/components/QueryState.vue";
import Pagination from "@/components/Pagination.vue";
const tabs: { key: Resource; title: string }[] = [
  { key: "authorities", title: "Potências" },
  { key: "lodges", title: "Lojas" },
  { key: "users", title: "Usuários" },
  { key: "user-lodges", title: "Vínculos" },
];
const active = ref<Resource>("authorities"),
  page = ref(1);
const title = computed(() => tabs.find((t) => t.key === active.value)!.title);
const query = useQuery(
  () => listAdmin(token.value, active.value, page.value),
  () => `${active.value}:${page.value}`,
  { requiresLodge: false },
);
const authorities = ref<Authority[]>([]),
  lodges = ref<AdminLodge[]>([]),
  users = ref<AdminUser[]>([]);
const optionsBusy = ref(false),
  optionsError = ref("");
const busy = ref(false),
  error = ref(""),
  success = ref("");
const form = reactive({
  label: "",
  name: "",
  number: "",
  document: "",
  authority: "",
  email: "",
  password: "",
  user: "",
  lodge: "",
});
function reset() {
  Object.assign(form, {
    label: "",
    name: "",
    number: "",
    document: "",
    authority: "",
    email: "",
    password: "",
    user: "",
    lodge: "",
  });
}
let optionRevision = 0;
async function loadOptions() {
  const revision = ++optionRevision;
  optionsError.value = "";
  optionsBusy.value = true;
  try {
    if (active.value === "lodges") {
      const result = await adminOptions(token.value, "authorities");
      if (revision === optionRevision) authorities.value = result;
    }
    if (active.value === "user-lodges") {
      const [u, l] = await Promise.all([
        adminOptions(token.value, "users"),
        adminOptions(token.value, "lodges"),
      ]);
      if (revision === optionRevision) {
        users.value = u;
        lodges.value = l;
      }
    }
  } catch (e) {
    if (revision === optionRevision) optionsError.value = message(e);
  } finally {
    if (revision === optionRevision) optionsBusy.value = false;
  }
}
watch(active, () => {
  page.value = 1;
  reset();
  error.value = success.value = "";
  void loadOptions();
});
async function save() {
  if (busy.value || optionsBusy.value || optionsError.value) return;
  busy.value = true;
  error.value = success.value = "";
  try {
    if (active.value === "authorities")
      await createAdmin(token.value, "authorities", {
        label: form.label,
        name: form.name,
      });
    if (active.value === "lodges")
      await createAdmin(token.value, "lodges", {
        label: form.label,
        number: form.number,
        masonic_authority_id: form.authority,
        juridical_document: form.document || undefined,
      });
    if (active.value === "users") {
      if (new TextEncoder().encode(form.password).length > 72)
        throw new Error(
          "A senha deve ter no máximo 72 bytes. Reduza o uso de acentos ou símbolos.",
        );
      await createAdmin(token.value, "users", {
        name: form.name,
        email: form.email,
        password: form.password,
      });
    }
    if (active.value === "user-lodges")
      await createAdmin(token.value, "user-lodges", {
        user_id: form.user,
        masonic_lodge_id: form.lodge,
      });
    success.value =
      active.value === "user-lodges"
        ? "Vínculo criado com sucesso."
        : "Cadastro criado com sucesso.";
    const refreshProfile =
      active.value === "user-lodges" && form.user === user.value?.id;
    reset();
    if (page.value === 1) await query.refresh();
    else page.value = 1;
    if (refreshProfile) {
      try {
        const profile = await getMe(token.value);
        user.value = profile.user;
        if (!lodgeId.value && profile.user.lodges[0])
          selectLodge(profile.user.lodges[0].id);
      } catch {
        success.value += " Entre novamente para atualizar suas lojas.";
      }
    }
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
      <p class="eyebrow">ADMINISTRAÇÃO</p>
      <h1>Cadastros do sistema</h1>
      <p>Gerencie potências, lojas, usuários e seus vínculos.</p>
    </div>
  </div>
  <nav class="admin-tabs" aria-label="Cadastros administrativos">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      :class="{ secondary: active !== tab.key }"
      :aria-pressed="active === tab.key"
      :disabled="busy"
      @click="active = tab.key"
    >
      {{ tab.title }}
    </button>
  </nav>
  <section class="section">
    <div class="section-head">
      <h2>
        {{
          active === "user-lodges"
            ? "Associar usuário a loja"
            : active === "authorities"
              ? "Cadastrar potência"
              : active === "lodges"
                ? "Cadastrar loja"
                : "Cadastrar usuário"
        }}
      </h2>
    </div>
    <form class="section-body" @submit.prevent="save">
      <p v-if="optionsBusy" role="status">Carregando opções…</p>
      <div v-if="optionsError" class="alert" role="alert">
        {{ optionsError }}
        <button type="button" class="secondary" @click="loadOptions">
          Tentar novamente
        </button>
      </div>
      <fieldset
        :disabled="busy || optionsBusy || !!optionsError"
        class="admin-fields"
      >
        <div class="form-grid">
          <template v-if="active === 'authorities'">
            <label
              >Sigla<input v-model="form.label" required maxlength="50"
            /></label>
            <label
              >Nome da potência<input
                v-model="form.name"
                required
                maxlength="255"
            /></label>
          </template>
          <template v-if="active === 'lodges'">
            <label
              >Nome da loja<input v-model="form.label" required maxlength="255"
            /></label>
            <label
              >Número<input
                v-model="form.number"
                inputmode="numeric"
                pattern="[1-9][0-9]{0,18}"
                required
                maxlength="19"
            /></label>
            <label
              >Potência<select v-model="form.authority" required>
                <option disabled value="">Selecione uma potência</option>
                <option v-for="a in authorities" :key="a.id" :value="a.id">
                  {{ a.label }} · {{ a.name }}
                </option>
              </select></label
            >
            <label
              >Documento jurídico (opcional)<input
                v-model="form.document"
                maxlength="14"
            /></label>
          </template>
          <template v-if="active === 'users'">
            <label
              >Nome<input
                v-model="form.name"
                autocomplete="name"
                required
                maxlength="255"
            /></label>
            <label
              >E-mail<input
                v-model="form.email"
                type="email"
                autocomplete="email"
                required
                maxlength="255"
            /></label>
            <label
              >Senha inicial<input
                v-model="form.password"
                type="password"
                autocomplete="new-password"
                required
                minlength="8"
                maxlength="72"
                aria-describedby="initial-password-help"
            /></label>
          </template>
          <template v-if="active === 'user-lodges'">
            <label
              >Usuário<select v-model="form.user" required>
                <option disabled value="">Selecione um usuário</option>
                <option v-for="u in users" :key="u.id" :value="u.id">
                  {{ u.name }} · {{ u.email }}{{ u.active ? "" : " (inativo)" }}
                </option>
              </select></label
            >
            <label
              >Loja<select v-model="form.lodge" required>
                <option disabled value="">Selecione uma loja</option>
                <option v-for="l in lodges" :key="l.id" :value="l.id">
                  {{ l.label }} · Nº {{ l.number }} ·
                  {{ l.masonic_authority.label }}
                </option>
              </select></label
            >
          </template>
        </div>
        <p v-if="active === 'users'" id="initial-password-help" class="muted">
          Use de 8 a 72 caracteres e até 72 bytes. O usuário poderá alterar a
          senha em Configurações. Associe suas lojas na aba Vínculos após o
          cadastro.
        </p>
        <p
          v-if="active === 'lodges' && !optionsBusy && !authorities.length"
          class="muted"
        >
          Cadastre uma potência antes de cadastrar a loja.
        </p>
        <p
          v-if="
            active === 'user-lodges' &&
            !optionsBusy &&
            (!users.length || !lodges.length)
          "
          class="muted"
        >
          Cadastre pelo menos um usuário e uma loja para criar vínculos.
        </p>
        <div class="form-actions">
          <button
            :disabled="
              busy ||
              (active === 'lodges' && !authorities.length) ||
              (active === 'user-lodges' && (!users.length || !lodges.length))
            "
          >
            {{
              busy
                ? "Salvando…"
                : active === "user-lodges"
                  ? "Criar vínculo"
                  : "Cadastrar"
            }}
          </button>
        </div>
      </fieldset>
      <p v-if="error" class="alert" role="alert">{{ error }}</p>
      <p v-if="success" class="success-message" role="status">{{ success }}</p>
    </form>
  </section>
  <section class="section">
    <div class="section-head">
      <h2>{{ title }}</h2>
    </div>
    <QueryState
      :loading="query.loading.value"
      :error="query.error.value"
      :empty="!query.data.value?.results.length"
      @retry="query.refresh"
    >
      <div v-for="row in query.data.value?.results" :key="row.id" class="row">
        <template v-if="'user' in row"
          ><div>
            <span class="row-title">{{ row.user.name }}</span
            ><span class="row-meta">{{ row.user.email }}</span>
          </div>
          <div>
            <span class="row-title"
              >{{ row.lodge.label }} · Nº {{ row.lodge.number }}</span
            ><span class="row-meta">{{
              row.lodge.masonic_authority.label
            }}</span>
          </div></template
        >
        <template v-else-if="'email' in row"
          ><div>
            <span class="row-title">{{ row.name }}</span
            ><span class="row-meta">{{ row.email }}</span>
          </div>
          <span class="badge"
            >{{ row.is_admin ? "Administrador" : "Usuário" }} ·
            {{ row.active ? "Ativo" : "Inativo" }}</span
          ></template
        >
        <template v-else-if="'number' in row"
          ><div>
            <span class="row-title">{{ row.label }} · Nº {{ row.number }}</span
            ><span class="row-meta"
              >{{ row.masonic_authority.label }} ·
              {{ row.masonic_authority.name }}</span
            >
          </div></template
        >
        <template v-else
          ><div>
            <span class="row-title">{{ row.label }}</span
            ><span class="row-meta">{{ row.name }}</span>
          </div></template
        >
      </div>
    </QueryState>
    <Pagination
      v-if="query.data.value"
      v-model:page="page"
      :total="query.data.value.total"
    />
  </section>
</template>
<style scoped>
.admin-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
}
.admin-fields {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
</style>
