import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { money } from "@/lib/format";
import { cashNames, kindNames, type CashPage, type CashFilters } from "./api";
const currency = (v: number) => money(v).replace(/\u00a0/g, " ");
const civilDate = (v: string) => v.split("-").reverse().join("/");
export function buildCashPdf(
  report: CashPage,
  lodge: string,
  filters: CashFilters,
) {
  const doc = new jsPDF();
  const title = `${filters.kind === "expense" ? "Despesas" : "Extrato"} - ${cashNames[report.cash]}`;
  doc.setProperties({ title, subject: lodge, author: "Entre Colunas" });
  let y = 22;
  doc.setFont("helvetica", "bold").setFontSize(16).text(title, 16, y);
  doc.setFont("helvetica", "normal").setFontSize(9);
  for (const line of [
    lodge,
    `${filters.from ? civilDate(filters.from) : "Início"} a ${filters.to ? civilDate(filters.to) : "data da emissão"}`,
    `Emitido em ${new Date(report.generated_at).toLocaleString("pt-BR")}`,
    "Datas dos lançamentos. Despesas exclusivas deste caixa, sem rateio.",
  ]) {
    const lines: string[] = doc.splitTextToSize(line, 178);
    y += 6;
    doc.text(lines, 16, y);
    y += (lines.length - 1) * 4.5;
  }
  autoTable(doc, {
    startY: y + 8,
    margin: { left: 16, right: 16, top: 22, bottom: 20 },
    head: [["Resumo", "Valor"]],
    body: [
      ["Saldo atual do caixa (todas as datas)", currency(report.balance)],
      ["Despesas nos filtros", currency(report.totals.expenses)],
      ...(!filters.kind
        ? [
            [
              "Entradas nos filtros (saldo inicial e transferências)",
              currency(report.totals.credits),
            ],
          ]
        : []),
      ["Quantidade de movimentos nos filtros", String(report.total)],
    ],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [1, 23, 51] },
    columnStyles: { 1: { halign: "right", cellWidth: 48 } },
    didDrawPage: (data) => {
      y = data.cursor?.y ?? y;
    },
  });
  autoTable(doc, {
    startY: y + 8,
    margin: { left: 16, right: 16, top: 22, bottom: 20 },
    head: [["Data", "Descrição / operação", "Direção", "Valor"]],
    body: report.results.length
      ? report.results.map((e) => [
          civilDate(e.occurred_on),
          `${e.description}\n${kindNames[e.kind]}`,
          e.direction === "credit" ? "Crédito" : "Débito",
          `${e.direction === "credit" ? "+" : "-"} ${currency(e.value)}`,
        ])
      : [[{ content: "Nenhum movimento nos filtros aplicados.", colSpan: 4 }]],
    styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
    headStyles: { fillColor: [1, 23, 51] },
    showHead: "everyPage",
    rowPageBreak: "avoid",
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 87 },
      2: { cellWidth: 23 },
      3: { cellWidth: 43, halign: "right" },
    },
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(80);
    if (page > 1) doc.text(title, 16, 14);
    doc.setDrawColor(220).line(16, 280, 194, 280);
    doc.text(`Entre Colunas - ${cashNames[report.cash]}`, 16, 286);
    doc.text(`${page} / ${pages}`, 194, 286, { align: "right" });
  }
  return doc;
}
