<script setup lang="ts">
import { Inbox, CircleAlert } from "@lucide/vue";
defineProps<{ loading: boolean; error: string; empty?: boolean }>();
defineEmits<{ retry: [] }>();
</script>
<template>
  <div
    v-if="loading"
    class="query-skeleton"
    role="status"
    aria-label="Carregando informações"
  >
    <span class="boot-sr">Carregando informações</span>
    <div
      v-for="row in 3"
      :key="row"
      class="query-skeleton-row"
      aria-hidden="true"
    >
      <span class="boot-bar" /><span class="boot-bar" />
    </div>
  </div>
  <div v-else-if="error" class="state error" role="alert">
    <CircleAlert class="state-icon" :size="24" aria-hidden="true" />
    <strong>Não foi possível carregar</strong>
    <p>{{ error }}</p>
    <button class="secondary" @click="$emit('retry')">Tentar novamente</button>
  </div>
  <div v-else-if="empty" class="state">
    <Inbox class="state-icon" :size="24" aria-hidden="true" />
    <strong>Nenhum registro encontrado</strong>
    <p>Os registros aparecerão aqui quando estiverem disponíveis.</p>
  </div>
  <slot v-else />
</template>

<style scoped>
.query-skeleton {
  width: 100%;
  min-width: 0;
  padding: 16px;
}
.query-skeleton-row {
  padding: 12px 0;
}
.query-skeleton-row .boot-bar {
  background: var(--border);
}
.query-skeleton-row .boot-bar + .boot-bar {
  margin-top: 10px;
  width: 40%;
}
</style>
