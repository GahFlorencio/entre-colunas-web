import type { MemberPeriodReport } from "../../src/domain/member-account/period-report";
export function memberPeriodReport(
  closed = true,
  count = 5,
): MemberPeriodReport {
  const types = ["contribution", "agape", "rateio", "individual", "acrescimo"];
  const names = [
    "Contribuição mensal",
    "Ágape mensal",
    "Parcela de despesa de período anterior",
    "Despesa individual do membro",
    "Acréscimo uniforme",
  ];
  const values = [100, 20, 33.33, 7.5, 5];
  const items = Array.from({ length: count }, (_, index) => ({
    key: String(index + 1),
    type: types[index % 5],
    description: `${names[index % 5]}${count > 5 ? ` ${index + 1} - Descrição completa de manutenção e conservação das instalações e atividades do membro neste ciclo` : ""}`,
    category_label: index % 5 === 2 ? "Manutenção e conservação" : null,
    value: values[index % 5],
    direction: "debit" as const,
    financial_operation_id: closed ? String(index + 1) : null,
  }));
  return {
    masonic_lodge_id: "12",
    financial_period_id: "81",
    sequence: 10,
    status: closed ? "closed" : "open",
    opened_at: "2026-10-01T12:00:00Z",
    closed_at: closed ? "2026-10-28T12:00:00Z" : null,
    generated_at: "2026-10-29T12:00:00Z",
    member_id: "21",
    member_name: "José Antônio de Albuquerque Nome Muito Longo",
    member_status_slug: "ativo",
    total_charges:
      items.reduce((sum, item) => sum + Math.round(item.value * 100), 0) / 100,
    items,
    impediments: [],
  };
}
