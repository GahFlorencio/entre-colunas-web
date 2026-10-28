import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import {
  expensePaymentLabel,
  expenseStatusLabel,
  expenseTypeLabel,
  summarizeExpenses,
  type ExpensesReport,
} from "./report";
const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(value)
    .replace(/\u00a0/g, " ");
const navy: [number, number, number] = [1, 23, 51];
const border: [number, number, number] = [225, 228, 232];
const pale: [number, number, number] = [246, 247, 249];
export function buildExpensesPdf(report: ExpensesReport) {
  const summary = summarizeExpenses(report.expenses);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = 16,
    right = 194,
    width = 178;
  doc.setProperties({
    title: "Relatório de despesas",
    subject: report.lodgeName,
    author: "Entre Colunas",
  });
  doc.setTextColor(151, 112, 31).setFont("helvetica", "bold").setFontSize(8);
  doc.text("ENTRE COLUNAS", left, 15);
  doc.setTextColor(100).setFont("helvetica", "normal").setFontSize(7);
  doc.text(
    `Emitido em ${new Date(report.generatedAt).toLocaleString("pt-BR")}`,
    right,
    15,
    { align: "right" },
  );
  doc
    .setTextColor(...navy)
    .setFont("helvetica", "bold")
    .setFontSize(18);
  doc.text("Relatório de despesas", left, 25);
  doc.setFont("helvetica", "normal").setFontSize(9.5);
  const lodgeLines: string[] = doc.splitTextToSize(report.lodgeName, width);
  doc.text(lodgeLines, left, 32);
  let y = 32 + lodgeLines.length * 4.2;
  doc.setFontSize(8).setTextColor(85);
  for (const line of doc.splitTextToSize(
    report.filters.length
      ? report.filters.join(" · ")
      : "Todas as despesas · sem filtros",
    width,
  ) as string[]) {
    doc.text(line, left, y + 1);
    y += 4;
  }
  y += 4;
  doc.setDrawColor(...border).line(left, y, right, y);
  y += 7;
  doc
    .setTextColor(...navy)
    .setFont("helvetica", "bold")
    .setFontSize(10);
  doc.text(
    `Resumo · ${summary.count} ${summary.count === 1 ? "registro" : "registros"}`,
    left,
    y,
  );
  let summaryEnd = y + 4;
  autoTable(doc, {
    startY: y + 4,
    margin: { left, right: left, top: 23, bottom: 18 },
    head: [["Situação", "Quantidade", "Valor original"]],
    body: summary.groups.map((group) => [
      group.label,
      String(group.count),
      currency(group.originalTotal),
    ]),
    foot: [
      [
        { content: "Total cadastrado (original)", colSpan: 2 },
        currency(summary.originalTotal),
      ],
    ],
    showFoot: "lastPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2,
      textColor: navy,
      lineColor: border,
    },
    headStyles: { fillColor: pale, textColor: navy, fontSize: 8 },
    footStyles: { fillColor: navy, textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 94 },
      1: { cellWidth: 30, halign: "center" },
      2: { cellWidth: 54, halign: "right" },
    },
    didDrawPage: (data) => {
      if (data.cursor) summaryEnd = data.cursor.y;
    },
  });
  y = summaryEnd + 5;
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(95);
  doc.text(
    "Valores originais de cadastro, sem abatimento de cancelamentos. Não representam saldo a pagar.",
    left,
    y,
  );
  y += 9;
  doc
    .setTextColor(...navy)
    .setFont("helvetica", "bold")
    .setFontSize(10);
  doc.text("Despesas registradas", left, y);
  autoTable(doc, {
    startY: y + 4,
    margin: { left, right: left, top: 23, bottom: 18 },
    head: [
      [
        "Despesa / categoria",
        "Tipo / destino",
        "Parcelas",
        "Situação",
        "Pagamento",
        "Valor original",
      ],
    ],
    body: report.expenses.length
      ? report.expenses.map((expense) => [
          `${expense.label}\n${report.categories[expense.expense_category_id] || expense.expense_category_slug}`,
          `${expenseTypeLabel(expense.expense_type_slug)}${expense.expense_type_slug === "individual" && expense.owner_expense_member_id ? `\nMembro #${expense.owner_expense_member_id}` : expense.expense_type_slug === "rateio" ? (expense.ratio_to_all ? "\nAtivos e afastados" : "\nAtivos") : ""}`,
          String(expense.parcels),
          expenseStatusLabel(expense.status),
          expense.status === "cancelled" ? "-" : expensePaymentLabel(expense),
          currency(expense.total_value),
        ])
      : [
          [
            {
              content: "Nenhuma despesa para os filtros selecionados.",
              colSpan: 6,
            },
          ],
        ],
    foot: [
      [
        { content: "Total cadastrado (original)", colSpan: 5 },
        currency(summary.originalTotal),
      ],
    ],
    showFoot: "lastPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 1.8,
      textColor: navy,
      lineColor: border,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: navy,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      cellPadding: 2,
    },
    footStyles: { fillColor: pale, textColor: navy, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 58 },
      1: { cellWidth: 30 },
      2: { cellWidth: 15 },
      3: { cellWidth: 27 },
      4: { cellWidth: 22 },
      5: { cellWidth: 26, halign: "right" },
    },
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    if (page > 1) {
      doc
        .setTextColor(...navy)
        .setFont("helvetica", "bold")
        .setFontSize(8);
      doc.text("Relatório de despesas · continuação", left, 14);
      doc.setDrawColor(...border).line(left, 18, right, 18);
    }
    doc.setDrawColor(...border).line(left, 281, right, 281);
    doc.setTextColor(100).setFont("helvetica", "normal").setFontSize(7);
    doc.text("Entre Colunas · Despesas", left, 286);
    doc.text(`${page} / ${pages}`, right, 286, { align: "right" });
  }
  return doc;
}
export function downloadExpensesPdf(report: ExpensesReport) {
  buildExpensesPdf(report).save(
    `despesas-${report.generatedAt.slice(0, 10)}.pdf`,
  );
}
