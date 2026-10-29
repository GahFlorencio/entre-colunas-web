<script setup lang="ts">
import { getMemberPeriodReport } from "@/domain/member-account/period-report";
import { token, lodgeId } from "@/lib/session";
import { useQuery } from "@/lib/query";
import { money } from "@/lib/format";
const props = defineProps<{ memberId: string; periodId: string }>();
const query = useQuery(
  () =>
    getMemberPeriodReport(
      token.value,
      lodgeId.value,
      props.memberId,
      props.periodId,
    ),
  () => [props.memberId, props.periodId],
);
</script>
<template>
  <span class="period-total"
    ><span v-if="query.loading.value" role="status">Carregando total…</span
    ><span v-else-if="query.error.value" class="period-total-error"
      >Total indisponível</span
    ><template v-else-if="query.data.value"
      ><small>{{
        query.data.value.status === "open" ? "Prévia" : "Cobranças"
      }}</small
      ><strong>{{ money(query.data.value.total_charges) }}</strong></template
    ></span
  >
</template>
<style scoped>
.period-total {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  font-size: 12px;
  color: var(--muted);
}
.period-total small {
  font-size: 11px;
}
.period-total strong {
  color: var(--text);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.period-total-error {
  color: var(--danger);
}
</style>
