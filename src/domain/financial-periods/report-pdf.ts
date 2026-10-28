import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { periodReportLines, periodReportStatementTotal } from "./report-lines";
import type { PeriodReport } from "./types";
const currency = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(n)
    .replace(/\u00a0/g, " ");
const date = (s: string) => new Date(s).toLocaleDateString("pt-BR");

/** Vector text and tables keep the report searchable and paginate long expense lists. */
export function buildPeriodReportPdf(report: PeriodReport, lodgeName: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const navy: [number, number, number] = [1, 23, 51],
    gold: [number, number, number] = [151, 112, 31];
  const width = 178,
    margin = 16;
  doc.setProperties({
    title: `Período ${report.sequence} - Relatório de cobranças`,
    subject: lodgeName,
    author: "Entre Colunas",
  });
  doc
    .setTextColor(...gold)
    .setFontSize(9)
    .setFont("helvetica", "bold");
  doc.text("ENTRE COLUNAS / RELATÓRIO FINANCEIRO", margin, 18);
  doc.setTextColor(...navy).setFontSize(21);
  doc.text(`Período ${report.sequence}`, margin, 30);
  doc.setFontSize(11).setFont("helvetica", "normal");
  const lodgeLines = doc.splitTextToSize(lodgeName, width);
  doc.text(lodgeLines, margin, 38);
  let y = 38 + lodgeLines.length * 5;
  doc.setFontSize(9).setTextColor(80);
  doc.text(
    `${report.status === "open" ? "Aberto - prévia de cobranças" : "Fechado - cobranças consolidadas"} | Abertura: ${date(report.opened_at)}${report.closed_at ? ` | Fechamento: ${date(report.closed_at)}` : ""}`,
    margin,
    y + 3,
  );
  doc.text(
    `Emitido em ${new Date(report.generated_at).toLocaleString("pt-BR")}`,
    margin,
    y + 9,
  );
  y += 18;
  const cardWidth = (width - 8) / 3;
  report.groups.forEach((group, index) => {
    const x = margin + index * (cardWidth + 4);
    doc.setFillColor(248, 247, 242).setDrawColor(218, 221, 225);
    doc.roundedRect(x, y, cardWidth, 47, 2, 2, "FD");
    doc
      .setTextColor(...navy)
      .setFontSize(10)
      .setFont("helvetica", "bold");
    doc.text(group.label, x + 4, y + 8);
    doc.setFontSize(9).setFont("helvetica", "normal");
    doc.text(`${group.member_count} membro(s)`, x + 4, y + 15);
    doc.setFontSize(15).setFont("helvetica", "bold");
    const amount =
      group.min_charge === group.max_charge
        ? currency(group.min_charge)
        : `${currency(group.min_charge)} a ${currency(group.max_charge)}`;
    if (doc.getTextWidth(amount) > cardWidth - 8) doc.setFontSize(10);
    doc.text(doc.splitTextToSize(amount, cardWidth - 8), x + 4, y + 23);
    doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(80);
    doc.text(
      group.key !== "away" && report.acrescimo
        ? "Por membro, com acréscimo"
        : "Por membro, já rateado",
      x + 4,
      y + 33,
    );
    doc.text(
      doc.splitTextToSize(
        `Total do grupo: ${currency(group.total_charges)}`,
        cardWidth - 8,
      ),
      x + 4,
      y + 40,
    );
  });
  y += 55;
  doc
    .setTextColor(...navy)
    .setFontSize(11)
    .setFont("helvetica", "bold");
  doc.text(
    `Total de novas cobranças: ${currency(report.total_charges)}`,
    margin,
    y,
  );
  y += 7;
  doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(80);
  const notes = [
    report.status === "open"
      ? `Prévia com acréscimo de ${currency(report.acrescimo)} por ativo, já incluído nos valores. Valores podem mudar até o fechamento.`
      : `Valores gravados no fechamento. Acréscimo por ativo: ${currency(report.acrescimo)}.`,
    "As cobranças incluem contribuição, ágape, rateios e despesas individuais aplicáveis. Não incluem saldos anteriores, pagamentos ou ajustes já lançados.",
    "Contagens e grupos seguem o quadro capturado na abertura. O extrato contém despesas de rateio, individuais e o acréscimo por ativo quando houver.",
    ...(report.other_members_count
      ? [
          `Fora dos três grupos: ${report.other_members_count} membro(s), total de novas cobranças ${currency(report.other_charges)}.`,
        ]
      : []),
    ...(report.impediments.length
      ? [`PRÉVIA COM IMPEDIMENTOS: ${report.impediments.join(" ")}`]
      : []),
    ...(report.differences.length
      ? [
          `Diferenças de rateio: ${currency(report.differences.reduce((sum, d) => sum + Math.round(d.value * 100), 0) / 100)}.`,
        ]
      : []),
  ];
  for (const note of notes) {
    const lines = doc.splitTextToSize(note, width);
    for (const line of lines) {
      if (y > 267) {
        doc.addPage();
        y = 22;
      }
      doc.text(line, margin, y);
      y += 4;
    }
    y += 2;
  }
  if (y > 235) {
    doc.addPage();
    y = 22;
  }
  doc
    .setTextColor(...navy)
    .setFontSize(12)
    .setFont("helvetica", "bold");
  doc.text("Extrato de despesas do período", margin, y + 3);
  const statementLines = periodReportLines(report);
  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin, top: 18, bottom: 18 },
    head: [
      [
        "Despesa / categoria",
        "Tipo / destinatários",
        "Parcela",
        "Valor total",
        "No ciclo",
        "Por membro",
      ],
    ],
    body: statementLines.length
      ? statementLines.map((e) => [
          `${e.description}\n${e.category}`,
          `${e.type === "acrescimo" ? "Acréscimo" : e.type === "individual" ? "Individual" : "Rateio"}\n${e.allocation}`,
          e.installment_number === null
            ? "Única"
            : `${e.installment_number}/${e.installments_count}`,
          currency(e.total_value),
          currency(e.value),
          e.allocated_value === null
            ? "Sem destinatários"
            : `${currency(e.allocated_value)}\n${e.divisor} membro(s)`,
        ])
      : [[{ content: "Nenhuma despesa neste período.", colSpan: 6 }]],
    foot: [
      [
        { content: "Total do extrato", colSpan: 4 },
        currency(periodReportStatementTotal(report)),
        "-",
      ],
    ],
    showFoot: "lastPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 3,
      textColor: navy,
      lineColor: [225, 228, 232],
    },
    headStyles: { fillColor: navy, textColor: [255, 255, 255] },
    footStyles: { fillColor: [248, 247, 242], textColor: navy },
    columnStyles: {
      0: { cellWidth: 48 },
      1: { cellWidth: 36 },
      2: { cellWidth: 18 },
      3: { cellWidth: 25, halign: "right" },
      4: { cellWidth: 25, halign: "right" },
      5: { cellWidth: 26, halign: "right" },
    },
  });
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc
      .setPage(page)
      .setFont("helvetica", "normal")
      .setFontSize(8)
      .setTextColor(100);
    doc.text("Entre Colunas - Relatório do período", margin, 287);
    doc.text(`${page} / ${doc.getNumberOfPages()}`, 194, 287, {
      align: "right",
    });
  }
  return doc;
}
export function downloadPeriodReport(report: PeriodReport, lodgeName: string) {
  buildPeriodReportPdf(report, lodgeName).save(
    `periodo-${report.sequence}-${report.status === "open" ? "previa" : "fechado"}.pdf`,
  );
}
