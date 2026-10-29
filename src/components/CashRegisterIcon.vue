<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string }>(), { size: 20 });
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M4 14h16l1 4v3H3v-3l1-4Z" />
    <path d="M6 14V7h12v7M8 7V3h8v4M3 18h18M10 21v-3" />
    <path d="M9 10h3M15 10h.01M9 12h.01M12 12h.01M15 12h.01" />
  </svg>
</template>
