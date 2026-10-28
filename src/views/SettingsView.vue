<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { token, lodgeId, user, lodge } from "@/lib/session";
import { message } from "@/lib/format";
import { useQuery } from "@/lib/query";
import {
  getLodgeFinancialSettings,
  updateLodgeFinancialSettings,
  listExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
} from "@/domain/expenses/api";
import type { ExpenseCategory } from "@/domain/expenses/types";
import ChangePasswordForm from "@/components/ChangePasswordForm.vue";
import Modal from "@/components/Modal.vue";
import QueryState from "@/components/QueryState.vue";
import Pagination from "@/components/Pagination.vue";
const query = useQuery(() =>
  getLodgeFinancialSettings(token.value, lodgeId.value),
);
const page = ref(1),
  categories = useQuery(
    () =>
      listExpenseCategories(token.value, lodgeId.value, "all", {
        page: page.value,
        perPage: 20,
      }),
    () => page.value,
  );
const form = reactive({ contribution: "", agape: "" }),
  busy = ref(false),
  error = ref(""),
  success = ref(""),
  category = ref(""),
  categoryBusy = ref(false),
  categoryError = ref("");
watch(query.data, (data) => {
  if (data) {
    form.contribution = String(data.monthly_contribution_value);
    form.agape = String(data.monthly_agape_value);
  }
});
async function save() {
  busy.value = true;
  error.value = "";
  success.value = "";
  try {
    await updateLodgeFinancialSettings(token.value, lodgeId.value, {
      monthly_contribution_value: Number(form.contribution),
      monthly_agape_value: Number(form.agape),
    });
    success.value = "Configurações salvas.";
    await query.refresh();
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}
const editingCategory = ref<ExpenseCategory | null>(null),
  categoryLabel = ref(""),
  categoryActive = ref(true);
function editCategory(value: ExpenseCategory) {
  editingCategory.value = value;
  categoryLabel.value = value.label;
  categoryActive.value = value.active;
  categoryError.value = "";
}
async function saveCategory() {
  if (!editingCategory.value) return;
  categoryBusy.value = true;
  categoryError.value = "";
  try {
    await updateExpenseCategory(
      token.value,
      lodgeId.value,
      editingCategory.value.id,
      { label: categoryLabel.value.trim(), active: categoryActive.value },
    );
    editingCategory.value = null;
    await categories.refresh();
  } catch (e) {
    categoryError.value = message(e);
  } finally {
    categoryBusy.value = false;
  }
}
async function addCategory() {
  categoryBusy.value = true;
  categoryError.value = "";
  try {
    await createExpenseCategory(token.value, lodgeId.value, {
      label: category.value.trim(),
    });
    category.value = "";
    await categories.refresh();
  } catch (e) {
    categoryError.value = message(e);
  } finally {
    categoryBusy.value = false;
  }
}
</script>
<template>
  <div class="page-header">
    <div>
      <p class="eyebrow">PREFERÊNCIAS DA LOJA</p>
      <h1>Configurações</h1>
      <p>Os valores e cadastros que orientam a gestão.</p>
    </div>
  </div>
  <div class="two-columns">
    <section class="section">
      <div class="section-head"><h2>Valores mensais</h2></div>
      <div class="section-body">
        <QueryState
          :loading="query.loading.value"
          :error="query.error.value"
          @retry="query.refresh"
          ><form @submit.prevent="save">
            <p class="muted" style="font-size: 13px">
              Os valores vigentes serão considerados pela API ao calcular o
              fechamento.
            </p>
            <p v-if="error" class="alert" role="alert">{{ error }}</p>
            <div class="form-grid">
              <label
                >Contribuição (R$)<input
                  v-model="form.contribution"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  :disabled="busy" /></label
              ><label
                >Ágape (R$)<input
                  v-model="form.agape"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  :disabled="busy"
              /></label>
            </div>
            <p v-if="success" class="success-message" role="status">
              {{ success }}
            </p>
            <div class="form-actions">
              <button :disabled="busy">
                {{ busy ? "Salvando…" : "Salvar valores" }}
              </button>
            </div>
          </form></QueryState
        >
      </div>
    </section>
    <section class="section">
      <div class="section-head"><h2>Minha conta e loja</h2></div>
      <div class="section-body">
        <dl class="details" style="grid-template-columns: 1fr">
          <div>
            <dt>Nome</dt>
            <dd>{{ user?.name }}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{{ user?.email }}</dd>
          </div>
          <div>
            <dt>Loja ativa</dt>
            <dd>{{ lodge?.label }} · Nº {{ lodge?.number }}</dd>
          </div>
          <div>
            <dt>Potência</dt>
            <dd>{{ lodge?.masonic_authority.name }}</dd>
          </div>
        </dl>
      </div>
    </section>
  </div>
  <ChangePasswordForm />
  <section class="section">
    <div class="section-head"><h2>Categorias de despesas</h2></div>
    <form class="section-body" @submit.prevent="addCategory">
      <div class="toolbar" style="margin: 0">
        <label
          >Nova categoria<input
            v-model="category"
            required
            maxlength="255"
            placeholder="Ex.: Manutenção predial"
            :disabled="categoryBusy" /></label
        ><button :disabled="categoryBusy">
          {{ categoryBusy ? "Criando…" : "Adicionar categoria" }}
        </button>
      </div>
      <p
        v-if="categoryError"
        class="alert"
        style="margin-top: 16px"
        role="alert"
      >
        {{ categoryError }}
      </p>
    </form>
    <QueryState
      :loading="categories.loading.value"
      :error="categories.error.value"
      :empty="!categories.data.value?.results.length"
      @retry="categories.refresh"
      ><div v-for="c in categories.data.value?.results" :key="c.id" class="row">
        <div>
          <span class="row-title">{{ c.label }}</span
          ><span class="row-meta">{{
            c.scope === "global" ? "Categoria global" : "Categoria da loja"
          }}</span>
        </div>
        <div class="row-main">
          <span :class="['badge', { success: c.active }]">{{
            c.active ? "Ativa" : "Inativa"
          }}</span
          ><button
            v-if="c.scope === 'lodge'"
            class="secondary"
            @click="editCategory(c)"
          >
            Editar
          </button>
        </div>
      </div></QueryState
    ><Pagination
      v-if="categories.data.value"
      v-model:page="page"
      :total="categories.data.value.total"
    />
  </section>
  <Modal
    v-if="editingCategory"
    title="Editar categoria"
    :busy="categoryBusy"
    @close="editingCategory = null"
    ><form @submit.prevent="saveCategory">
      <p v-if="categoryError" class="alert" role="alert">{{ categoryError }}</p>
      <label
        >Nome da categoria<input
          v-model="categoryLabel"
          required
          maxlength="255"
          :disabled="categoryBusy" /></label
      ><label class="checkbox" style="margin-top: 16px"
        ><input
          v-model="categoryActive"
          type="checkbox"
          :disabled="categoryBusy"
        />Categoria ativa</label
      >
      <div class="form-actions">
        <button
          type="button"
          class="secondary"
          :disabled="categoryBusy"
          @click="editingCategory = null"
        >
          Cancelar</button
        ><button :disabled="categoryBusy">
          {{ categoryBusy ? "Salvando…" : "Salvar categoria" }}
        </button>
      </div>
    </form></Modal
  >
</template>
