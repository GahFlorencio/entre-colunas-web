<script setup lang="ts">
defineProps<{ loading: boolean; error: string; empty?: boolean }>();
defineEmits<{ retry: [] }>();
</script>
<template>
  <div v-if="loading" class="state" role="status">
    <span class="spinner" /> Carregando informações…
  </div>
  <div v-else-if="error" class="state error" role="alert">
    <strong>Não foi possível carregar</strong>
    <p>{{ error }}</p>
    <button class="secondary" @click="$emit('retry')">Tentar novamente</button>
  </div>
  <div v-else-if="empty" class="state">
    <strong>Nenhum registro encontrado</strong>
    <p>Os registros aparecerão aqui quando estiverem disponíveis.</p>
  </div>
  <slot v-else />
</template>
