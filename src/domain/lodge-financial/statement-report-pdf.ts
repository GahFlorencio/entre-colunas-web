import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { money, date } from "@/lib/format";
import type { StatementReport } from "./statement-report";

const currency = (value: number) => money(value).replace(/\u00a0/g, " ");
const navy: [number, number, number] = [1, 23, 51];

export function buildStatementPdf(report: StatementReport) {
  const doc = new jsPDF();
  const left = 16,
    width = 178;
  doc.setProperties({
    title: "Extrato da loja",
    subject: report.lodgeName,
    author: "Entre Colunas",
  });
  doc
    .setFont("helvetica", "bold")
    .setFontSize(18)
    .setTextColor(...navy);
  doc.text("Extrato da loja", left, 24);
  const filters =
    [
      report.from && `De ${report.from.split("-").reverse().join("/")}`,
      report.to && `Até ${report.to.split("-").reverse().join("/")}`,
    ]
      .filter(Boolean)
      .join(" - ") || "Sem filtros de data";
  let y = 32;
  doc.setFont("helvetica", "normal").setFontSize(9);
  for (const text of [
    report.lodgeName,
    filters,
    `Emitido em ${new Date(report.generatedAt).toLocaleString("pt-BR")}`,
  ]) {
    const lines = doc.splitTextToSize(text, width) as string[];
    doc.text(lines, left, y);
    y += lines.length * 4.5 + 2;
  }
  autoTable(doc, {
    startY: y + 2,
    margin: { left, right: left, top: 22, bottom: 19 },
    head: [["Resumo", "Valor"]],
    body: [
      ["Saldo contábil global da conta", currency(report.balance)],
      ["Movimentações nos filtros", String(report.total)],
    ],
    styles: { fontSize: 9, cellPadding: 2.5, textColor: navy },
    headStyles: { fillColor: navy, textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 128 },
      1: { cellWidth: 50, halign: "right" },
    },
    didDrawPage: (data) => {
      y = data.cursor?.y ?? y;
    },
  });
  const note =
    "O saldo é global, independente das datas e da paginação. Pode diferir do caixa administrativo. Datas dos movimentos: registro da operação.";
  const noteLines = doc.splitTextToSize(note, width) as string[];
  doc.setFontSize(8).setTextColor(85);
  doc.text(noteLines, left, y + 6);
  y += noteLines.length * 4 + 10;
  autoTable(doc, {
    startY: y,
    margin: { left, right: left, top: 22, bottom: 19 },
    head: [["Data - categoria", "Descrição", "Direção", "Valor"]],
    body: report.movements.length
      ? report.movements.map((m) => [
          [date(m.created_at), m.category_label].filter(Boolean).join(" - "),
          m.description,
          m.direction === "credit" ? "Crédito" : "Débito",
          `${m.direction === "credit" ? "+" : "-"} ${currency(m.value)}`,
        ])
      : [
          [
            {
              content: "Nenhuma movimentação nos filtros aplicados.",
              colSpan: 4,
            },
          ],
        ],
    rowPageBreak: "avoid",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: navy,
      overflow: "linebreak",
    },
    headStyles: { fillColor: navy, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [246, 247, 249] },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 82 },
      2: { cellWidth: 21 },
      3: { cellWidth: 33, halign: "right" },
    },
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    if (page > 1) {
      doc
        .setTextColor(...navy)
        .setFontSize(9)
        .setFont("helvetica", "bold");
      doc.text("Extrato da loja", left, 14);
    }
    doc.setDrawColor(220).line(left, 280, 194, 280);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(90);
    doc.text("Entre Colunas - Extrato da loja", left, 286);
    doc.text(`${page} / ${pages}`, 194, 286, { align: "right" });
  }
  return doc;
}

export function downloadStatementPdf(report: StatementReport) {
  buildStatementPdf(report).save("extrato-da-loja.pdf");
}
