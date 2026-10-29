import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { chargeTypeLabel, type MemberPeriodReport } from "./period-report";
import { money, date } from "@/lib/format";
const navy: [number, number, number] = [1, 23, 51];
const currency = (value: number) => money(value).replace(/\u00a0/g, " ");
/** Full official snapshot: independent of the page currently displayed. */
export function buildMemberPeriodPdf(
  report: MemberPeriodReport,
  lodgeName: string,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 16,
    width = 178;
  doc.setProperties({
    title: `Cobranças do membro - Período ${report.sequence}`,
    subject: lodgeName,
    author: "Entre Colunas",
  });
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(151, 112, 31);
  doc.text("ENTRE COLUNAS", margin, 14);
  doc.setFont("helvetica", "normal").setTextColor(85).setFontSize(7);
  doc.text(
    `Emitido em ${new Date(report.generated_at).toLocaleString("pt-BR")}`,
    194,
    14,
    { align: "right" },
  );
  doc
    .setFont("helvetica", "bold")
    .setFontSize(17)
    .setTextColor(...navy);
  doc.text(`Cobranças - Período ${report.sequence}`, margin, 24);
  let y = 32;
  function text(value: string, bold = false, size = 9) {
    doc
      .setFont("helvetica", bold ? "bold" : "normal")
      .setFontSize(size)
      .setTextColor(...navy);
    const lines: string[] = doc.splitTextToSize(value, width);
    const lineHeight = size * 0.43;
    for (const line of lines) {
      if (y + lineHeight > 276) {
        doc.addPage();
        y = 25;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += 2;
  }
  text(lodgeName);
  text(report.member_name, true, 10);
  text(
    `${report.status === "open" ? "ABERTO - PRÉVIA" : "FECHADO"} | ${date(report.opened_at)} - ${report.closed_at ? date(report.closed_at) : "Em andamento"}`,
    false,
    8,
  );
  text(`Cobranças do período: ${currency(report.total_charges)}`, true, 11);
  text(
    "Total das cobranças do ciclo, incluindo acréscimo quando houver. Pagamentos, ajustes e saldo anterior não compõem este total; não representa saldo a pagar.",
    false,
    8,
  );
  text(
    report.status === "open"
      ? "Prévia oficial, sujeita a alterações até o fechamento. Não constitui cobrança já lançada."
      : "Valores e nome do membro preservados no fechamento.",
    false,
    8,
  );
  if (report.impediments.length) {
    text("Prévia com pendências", true, 9);
    for (const item of report.impediments) text(`- ${item}`, false, 8);
  }
  if (y > 253) {
    doc.addPage();
    y = 25;
  }
  autoTable(doc, {
    startY: y + 2,
    margin: { left: margin, right: margin, top: 24, bottom: 20 },
    head: [["Descrição", "Tipo / Categoria", "Por membro"]],
    body: report.items.length
      ? report.items.map((item) => [
          item.description,
          [chargeTypeLabel(item.type), item.category_label]
            .filter(Boolean)
            .join(" / "),
          currency(item.value),
        ])
      : [[{ content: "Nenhuma cobrança neste período", colSpan: 3 }]],
    foot: [
      [
        { content: "Total das cobranças do período", colSpan: 2 },
        currency(report.total_charges),
      ],
    ],
    showFoot: "lastPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.5,
      overflow: "linebreak",
      textColor: navy,
      lineColor: [225, 228, 232],
    },
    headStyles: { fillColor: [246, 247, 249], textColor: navy, fontSize: 8 },
    footStyles: { fillColor: navy, textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 86 },
      1: { cellWidth: 52 },
      2: { cellWidth: 40, halign: "right" },
    },
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    if (page > 1) {
      doc
        .setFont("helvetica", "bold")
        .setFontSize(8)
        .setTextColor(...navy);
      doc.text(`Cobranças do membro - Período ${report.sequence}`, margin, 14);
    }
    doc.setDrawColor(225, 228, 232).line(margin, 282, 194, 282);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(100);
    doc.text("Entre Colunas | Demonstrativo por membro", margin, 287);
    doc.text(`Página ${page} de ${pages}`, 194, 287, { align: "right" });
  }
  return doc;
}
