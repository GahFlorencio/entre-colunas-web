<script setup lang="ts">
import { onMounted, ref } from "vue";
import { X } from "@lucide/vue";
const props = defineProps<{ title: string; busy?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();
onMounted(() => {
  dialog.value?.showModal();
});
function cancel(event: Event) {
  event.preventDefault();
  if (!props.busy) emit("close");
}
</script>
<template>
  <dialog ref="dialog" @cancel="cancel" aria-labelledby="modal-title">
    <div class="modal-head">
      <h2 id="modal-title">{{ title }}</h2>
      <button
        class="icon-button"
        aria-label="Fechar"
        :disabled="busy"
        @click="$emit('close')"
      >
        <X aria-hidden="true" :size="20" />
      </button>
    </div>
    <slot />
  </dialog>
</template>
