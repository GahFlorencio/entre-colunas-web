<script setup lang="ts">
import { computed, nextTick, ref, useId } from "vue";
import { ChevronDown, Search, Check, ArrowLeft } from "@lucide/vue";
const props = defineProps<{
  modelValue: string;
  label: string;
  allLabel: string;
  options: { value: string; label: string; detail?: string }[];
  loading?: boolean;
  error?: string;
}>();
const emit = defineEmits<{
  "update:modelValue": [string];
  retry: [];
  editing: [boolean];
}>();
const id = useId(),
  open = ref(false),
  search = ref(""),
  input = ref<HTMLInputElement>(),
  trigger = ref<HTMLButtonElement>();
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
// Normalize the catalog only when its options change, not on every keystroke.
const indexedOptions = computed(() =>
  props.options.map((option) => ({
    option,
    text: normalize(`${option.label} ${option.detail || ""}`),
  })),
);
const matches = computed(() => {
  const term = normalize(search.value.trim());
  if (!term) return props.options;
  return indexedOptions.value
    .filter(({ text }) => text.includes(term))
    .map(({ option }) => option);
});
const selected = computed(() =>
  props.options.find((o) => o.value === props.modelValue),
);
async function toggle() {
  open.value = !open.value;
  if (open.value) {
    search.value = "";
    await nextTick();
    emit("editing", true);
    if (matchMedia("(pointer: fine)").matches) input.value?.focus();
  } else emit("editing", false);
}
function select(value: string) {
  emit("update:modelValue", value);
  open.value = false;
  emit("editing", false);
  nextTick(() => trigger.value?.focus());
}
function close(event: KeyboardEvent) {
  if (!open.value) return;
  event.stopPropagation();
  event.preventDefault();
  open.value = false;
  emit("editing", false);
  nextTick(() => trigger.value?.focus());
}
</script>
<template>
  <div :class="['search-select', { 'is-open': open }]" @keydown.esc="close">
    <span v-if="!open" :id="`${id}-label`" class="selector-label">{{
      label
    }}</span>
    <button
      v-if="!open"
      ref="trigger"
      type="button"
      class="secondary selector-trigger"
      :aria-label="`${label}: ${selected?.label || (modelValue ? 'Selecionado' : allLabel)}`"
      :aria-expanded="open"
      :aria-controls="`${id}-panel`"
      @click="toggle"
    >
      <span>{{
        selected?.label || (modelValue ? `#${modelValue}` : allLabel)
      }}</span
      ><ChevronDown :size="17" aria-hidden="true" />
    </button>
    <div
      v-if="open"
      :id="`${id}-panel`"
      class="selector-panel"
      role="group"
      :aria-label="label"
    >
      <button type="button" class="secondary picker-back" @click="toggle">
        <ArrowLeft :size="16" aria-hidden="true" />Voltar aos filtros
      </button>
      <div class="selector-search">
        <Search :size="16" aria-hidden="true" /><input
          ref="input"
          v-model="search"
          type="search"
          :aria-label="`Buscar ${label.toLocaleLowerCase('pt-BR')}`"
          placeholder="Buscar…"
          autocomplete="off"
        />
      </div>
      <p v-if="loading" class="selector-state" role="status">Carregando…</p>
      <div v-else-if="error" class="selector-state" role="alert">
        <p>{{ error }}</p>
        <button type="button" class="secondary" @click="emit('retry')">
          Tentar novamente
        </button>
      </div>
      <div v-else class="selector-options">
        <button
          type="button"
          class="secondary selector-option"
          :aria-pressed="!modelValue"
          @click="select('')"
        >
          <span>{{ allLabel }}</span
          ><Check v-if="!modelValue" :size="16" aria-hidden="true" />
        </button>
        <button
          v-for="option in matches"
          :key="option.value"
          type="button"
          class="secondary selector-option"
          :aria-pressed="modelValue === option.value"
          @click="select(option.value)"
        >
          <span
            >{{ option.label
            }}<small v-if="option.detail">{{ option.detail }}</small></span
          ><Check
            v-if="modelValue === option.value"
            :size="16"
            aria-hidden="true"
          />
        </button>
        <p v-if="!matches.length" class="selector-state" role="status">
          Nenhum resultado.
        </p>
      </div>
    </div>
  </div>
</template>
<style scoped>
.search-select {
  width: 100%;
  min-width: 0;
  align-self: stretch;
}
.search-select.is-open {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.picker-back {
  align-self: flex-start;
  min-height: 44px;
  padding: 8px;
  margin-bottom: 8px;
  font-size: 12px;
}
.selector-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}
.selector-trigger {
  width: 100%;
  min-height: 44px;
  justify-content: space-between;
  text-align: left;
  gap: 8px;
}
.selector-trigger > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selector-trigger svg {
  flex-shrink: 0;
}
.selector-panel {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.selector-search {
  display: flex;
  align-items: center;
  position: relative;
  flex-shrink: 0;
  height: 44px;
  margin-bottom: 8px;
  color: var(--muted);
}
.selector-search > svg {
  position: absolute;
  left: 12px;
  pointer-events: none;
}
.selector-search input {
  box-sizing: border-box;
  min-width: 0;
  width: 100%;
  height: 44px;
  min-height: 44px;
  padding: 8px 12px 8px 36px;
  font-size: 16px;
  margin: 0;
}
.selector-search input:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: -2px;
}
.selector-options {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.selector-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
  width: 100%;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text);
  padding: 8px 12px;
  flex-shrink: 0;
  text-align: left;
  font-size: 13px;
  font-weight: 500;
}
.selector-option > span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.selector-option small {
  display: block;
  font-size: 12px;
  color: var(--muted);
  margin-top: 3px;
  font-weight: 400;
}
.selector-option[aria-pressed="true"] {
  background: var(--bg);
  color: var(--gold);
}
.selector-option svg {
  flex-shrink: 0;
}
.selector-state {
  font-size: 12px;
  padding: 12px;
  margin: 0;
  color: var(--muted);
}
.selector-state p {
  margin-top: 0;
}
.selector-option:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: -2px;
}
</style>
