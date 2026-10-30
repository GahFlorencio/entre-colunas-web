<script setup lang="ts">
import { computed } from "vue";
import { date } from "@/lib/format";
import { type PaymentRecency } from "@/domain/members/payment-recency";
const props = defineProps<{
  value?: PaymentRecency;
  loading?: boolean;
  compact?: boolean;
}>();
const days = computed(() => props.value?.days_since_last_payment ?? null);
</script>
<template>
  <div :class="['payment-recency', 'neutral', { compact }]">
    <span class="payment-recency-label" v-if="loading"
      >Consultando pagamentos…</span
    >
    <span class="payment-recency-label" v-else-if="!value"
      >Pagamentos indisponíveis</span
    >
    <template v-else>
      <span
        class="payment-recency-label"
        title="Tempo desde a referência de pagamento; não indica vencimento ou atraso."
        >{{
          days === null
            ? "Sem período ou pagamento registrado"
            : `Sem pagamento há ${days} ${days === 1 ? "dia" : "dias"}`
        }}</span
      >
      <span v-if="value.reference_at && !compact" class="payment-recency-date"
        >{{
          value.reference_source === "first_period"
            ? "Desde o primeiro período"
            : value.reference_source === "adjustment"
              ? "Último ajuste a crédito"
              : value.reference_source === "opening_balance"
                ? "Saldo inicial a crédito"
                : "Último pagamento"
        }}: {{ date(value.reference_at) }}</span
      >
    </template>
  </div>
</template>
<style scoped>
.payment-recency {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  border-left: 3px solid currentColor;
  padding: 4px 0 4px 10px;
  margin: 10px 0 0;
}
.payment-recency .payment-recency-label {
  color: inherit;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.payment-recency .payment-recency-date {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}
.green {
  color: var(--success);
}
.yellow {
  color: var(--payment-yellow);
}
.orange {
  color: var(--payment-orange);
}
.red {
  color: var(--danger);
}
.neutral {
  color: var(--muted);
}
.payment-recency.compact {
  display: inline-flex;
  margin: 0;
  padding: 6px 9px;
  border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
  background: color-mix(in srgb, currentColor 6%, transparent);
  border-radius: 6px;
  max-width: 100%;
}
.payment-recency.compact .payment-recency-label {
  font-weight: 500;
}
</style>
