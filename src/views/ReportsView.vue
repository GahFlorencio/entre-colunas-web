<script setup lang="ts">
import {
  Receipt,
  UsersRound,
  BookOpen,
  CalendarRange,
  ArrowRight,
} from "@lucide/vue";
const reports = [
  {
    title: "Ágape",
    description: "Extrato e despesas do caixa Ágape por mês ou intervalo.",
    to: "/caixas/agape",
    icon: Receipt,
    action: "Abrir caixa",
  },
  {
    title: "Hospitalaria",
    description:
      "Extrato e despesas do caixa Hospitalaria por mês ou intervalo.",
    to: "/caixas/hospitalaria",
    icon: Receipt,
    action: "Abrir caixa",
  },
  {
    title: "Conta da loja",
    description: "Movimentações, saldo contábil e intervalo de datas.",
    to: "/extrato",
    icon: BookOpen,
    action: "Abrir extrato",
  },
  {
    title: "Despesas",
    description: "Consulte despesas, situações e filtros antes de exportar.",
    to: "/despesas",
    icon: Receipt,
    action: "Ver despesas",
  },
  {
    title: "Cobranças por membro",
    description: "Acesse o histórico de ciclos e demonstrativos individuais.",
    to: "/membros",
    icon: UsersRound,
    action: "Ver membros",
  },
  {
    title: "Períodos",
    description: "Abra um ciclo para consultar a composição ou gerar o PDF.",
    to: "/periodos",
    icon: CalendarRange,
    action: "Ver períodos",
  },
];
</script>
<template>
  <header class="page-header">
    <div>
      <h1>Extratos e relatórios</h1>
      <p class="muted">Escolha uma fonte para consultar e exportar os dados.</p>
    </div>
  </header>
  <section class="report-grid" aria-label="Fontes de relatórios">
    <RouterLink
      v-for="report in reports"
      :key="report.title"
      class="report-source"
      :to="report.to"
    >
      <component :is="report.icon" :size="20" aria-hidden="true" />
      <span
        ><strong>{{ report.title }}</strong
        ><small>{{ report.description }}</small
        ><b>{{ report.action }} <ArrowRight :size="15" aria-hidden="true" /></b
      ></span>
    </RouterLink>
  </section>
</template>
<style scoped>
.report-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.report-source {
  min-width: 0;
  min-height: 180px;
  padding: 22px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-surface);
  background: var(--surface);
}
.report-source > svg {
  color: var(--gold);
  flex: none;
}
.report-source span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.report-source strong {
  font-size: 16px;
}
.report-source small {
  color: var(--muted);
  line-height: 1.55;
}
.report-source b {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--gold);
}
.report-source:hover {
  border-color: var(--gold);
}
@media (max-width: 600px) {
  .report-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .report-source {
    min-height: 130px;
    padding: 16px;
  }
}
</style>
