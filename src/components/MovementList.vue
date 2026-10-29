<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Receipt,
} from "@lucide/vue";
import { money, label } from "@/lib/format";
export type MovementListItem = {
  key: string;
  description: string;
  value: number | null;
  direction: "credit" | "debit" | "neutral";
  group: string;
  meta: string;
  to?: string;
  valueLabel?: string;
  unsigned?: boolean;
  details?: { label: string; value: string }[];
};
const props = withDefaults(
  defineProps<{ items: MovementListItem[]; showDates?: boolean }>(),
  { showDates: true },
);
const groups = computed(() => {
  const result: { title: string; items: MovementListItem[] }[] = [];
  for (const item of props.items) {
    const last = result[result.length - 1];
    if (last && (!props.showDates || last.title === item.group))
      last.items.push(item);
    else result.push({ title: item.group, items: [item] });
  }
  return result;
});
</script>
<template>
  <div class="ledger-days">
    <div v-for="(group, index) in groups" :key="index" class="ledger-day">
      <h3 v-if="showDates">{{ group.title }}</h3>
      <component
        :is="m.to ? RouterLink : 'div'"
        v-for="m in group.items"
        :key="m.key"
        :to="m.to"
        :class="['ledger-entry', { 'ledger-link': m.to }]"
        ><span :class="['ledger-icon', m.direction]" aria-hidden="true"
          ><ArrowDownLeft
            v-if="m.direction === 'credit'"
            :size="18" /><ArrowUpRight
            v-else-if="m.direction === 'debit'"
            :size="18" /><Receipt v-else :size="18"
        /></span>
        <div class="ledger-copy">
          <span class="ledger-title">{{ m.description }}</span
          ><span v-if="m.meta" class="ledger-meta">{{ m.meta }}</span>
          <dl v-if="m.details?.length" class="ledger-details">
            <div v-for="detail in m.details" :key="detail.label">
              <dt>{{ detail.label }}</dt>
              <dd>{{ detail.value }}</dd>
            </div>
          </dl>
        </div>
        <div class="ledger-value">
          <strong :class="m.direction === 'credit' ? 'positive' : ''"
            >{{
              m.value === null || m.unsigned || m.direction === "neutral"
                ? ""
                : m.direction === "credit"
                  ? "+"
                  : "−"
            }}
            {{ m.value === null ? "—" : money(m.value) }}</strong
          ><span>{{
            m.valueLabel ||
            (m.direction === "neutral"
              ? "Valor registrado"
              : label(m.direction))
          }}</span>
        </div>
        <ChevronRight
          v-if="m.to"
          class="ledger-chevron"
          :size="16"
          aria-hidden="true"
      /></component>
    </div>
  </div>
</template>
<style scoped>
.ledger-day h3 {
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
  margin: 0;
  padding: 14px 0 8px;
}
.ledger-day:first-child h3 {
  padding-top: 0;
}
.ledger-entry {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  column-gap: 10px;
  row-gap: 5px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
  align-items: start;
}
.ledger-link {
  color: inherit;
  text-decoration: none;
}
.ledger-link:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: -2px;
}
.ledger-link:hover {
  background: var(--surface);
}
.ledger-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  grid-row: 1 / 3;
}
.ledger-icon.credit {
  color: var(--success);
}
.ledger-copy {
  min-width: 0;
}
.ledger-title {
  display: block;
  font-weight: 600;
  font-size: 14px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.ledger-details {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
  margin: 8px 0 0;
  font-size: 12px;
}
.ledger-details > div {
  min-width: 0;
}
.ledger-details dt {
  color: var(--muted);
}
.ledger-details dd {
  margin: 2px 0 0;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.ledger-meta {
  display: block;
  color: var(--muted);
  font-size: 12px;
  margin-top: 4px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.ledger-value {
  grid-column: 2;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.ledger-value strong {
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.ledger-value span {
  color: var(--muted);
  font-size: 11px;
}
.ledger-chevron {
  display: none;
}
@media (min-width: 600px) {
  .ledger-entry {
    grid-template-columns: 40px minmax(0, 1fr) minmax(0, auto) 16px;
    align-items: center;
    gap: 14px;
  }
  .ledger-icon {
    grid-row: auto;
  }
  .ledger-value {
    grid-column: auto;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    max-width: 250px;
  }
  .ledger-chevron {
    display: block;
    color: var(--muted);
  }
}
</style>
