<script setup lang="ts">
defineProps<{
  page: number;
  total: number;
  perPage?: number;
  loading?: boolean;
}>();
defineEmits<{ "update:page": [number] }>();
</script>
<template>
  <div class="pagination">
    <span
      >{{ total }} registro(s) · Página {{ page }} de
      {{ Math.max(1, Math.ceil(total / (perPage || 20))) }}</span
    >
    <div>
      <button
        class="secondary"
        :disabled="page <= 1 || loading"
        @click="$emit('update:page', page - 1)"
      >
        Anterior</button
      ><button
        class="secondary"
        :disabled="page * (perPage || 20) >= total || loading"
        @click="$emit('update:page', page + 1)"
      >
        Próxima
      </button>
    </div>
  </div>
</template>
