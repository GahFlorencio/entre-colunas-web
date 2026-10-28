import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { periodReportLines, periodReportStatementTotal } from "./report-lines";
import type { PeriodReport, PeriodReportMetadata } from "./types";

const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(value)
    .replace(/\u00a0/g, " ");
const date = (value: string) => new Date(value).toLocaleDateString("pt-BR");
const navy: [number, number, number] = [1, 23, 51];
const gold: [number, number, number] = [151, 112, 31];
const pale: [number, number, number] = [246, 247, 249];
const border: [number, number, number] = [225, 228, 232];

/** Print-oriented accounting layout; shares the financial data and lines with the screen. */
export function buildPeriodReportPdf(
  report: PeriodReport,
  lodgeName: string,
  details: PeriodReportMetadata,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 16,
    width = 178,
    right = margin + width;
  doc.setProperties({
    title: `Prestação de contas - Período ${report.sequence}`,
    subject: lodgeName,
    author: "Entre Colunas",
  });
  doc
    .setFont("helvetica", "bold")
    .setFontSize(8)
    .setTextColor(...gold);
  doc.text("ENTRE COLUNAS", margin, 15);
  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(100);
  doc.text(
    `Emitido em ${new Date(report.generated_at).toLocaleString("pt-BR")}`,
    right,
    15,
    { align: "right" },
  );
  doc
    .setFont("helvetica", "bold")
    .setFontSize(18)
    .setTextColor(...navy);
  doc.text("Prestação de contas", margin, 25);
  doc.setFontSize(8).setTextColor(...gold);
  doc.text(report.status === "closed" ? "FECHADO" : "PRÉVIA", right, 24, {
    align: "right",
  });
  doc
    .setFont("helvetica", "normal")
    .setFontSize(9.5)
    .setTextColor(...navy);
  const lodgeLines: string[] = doc.splitTextToSize(lodgeName, width);
  doc.text(lodgeLines, margin, 32);
  let y = 32 + lodgeLines.length * 4.2;
  doc.setFontSize(8).setTextColor(85);
  doc.text(
    `Período ${report.sequence} · ${date(report.opened_at)}${report.closed_at ? ` a ${date(report.closed_at)}` : " · em andamento"} · Despesas e cobranças`,
    margin,
    y + 1,
  );
  y += 5;
  doc
    .setDrawColor(...border)
    .setLineWidth(0.25)
    .line(margin, y, right, y);
  y += 5;
  const metadata = [
    `${details.captured_members} ${details.captured_members === 1 ? "membro" : "membros"}`,
    ...(report.status === "closed"
      ? [
          `${details.statements_count} ${details.statements_count === 1 ? "demonstrativo" : "demonstrativos"}`,
        ]
      : []),
  ];
  doc.setFontSize(8).text(metadata.join(" · "), margin, y);
  const amounts = [
    ...(report.status === "closed" &&
    details.closing_contribution_value !== null
      ? [`Contribuição: ${currency(details.closing_contribution_value)}`]
      : []),
    ...(report.status === "closed" && details.closing_agape_value !== null
      ? [`Ágape: ${currency(details.closing_agape_value)}`]
      : []),
    ...(report.acrescimo
      ? [`Acréscimo: ${currency(report.acrescimo)} / ativo`]
      : []),
  ];
  if (amounts.length) {
    const lines: string[] = doc.splitTextToSize(amounts.join(" · "), width);
    doc.text(lines, margin, y + 4);
    y += lines.length * 4;
  }
  y += 8;
  function heading(number: string, title: string, top: number) {
    doc
      .setFont("helvetica", "bold")
      .setFontSize(8)
      .setTextColor(...gold);
    doc.text(number, margin, top);
    doc.setFontSize(10).setTextColor(...navy);
    doc.text(title, margin + 7, top);
  }
  heading("01", "Cobranças por perfil", y);
  let summaryEnd = y + 5;
  const summary = report.groups.map((group) => [
    group.label,
    String(group.member_count),
    !group.member_count
      ? "-"
      : group.min_charge === group.max_charge
        ? currency(group.min_charge)
        : `${currency(group.min_charge)} a ${currency(group.max_charge)}`,
    currency(group.total_charges),
  ]);
  if (report.other_members_count)
    summary.push([
      "Outros membros",
      String(report.other_members_count),
      "-",
      currency(report.other_charges),
    ]);
  autoTable(doc, {
    startY: y + 4,
    margin: { left: margin, right: margin, top: 23, bottom: 18 },
    head: [["Perfil", "Membros", "Por membro", "Total do grupo"]],
    body: summary,
    foot: [
      [
        { content: "Total a cobrar", colSpan: 3 },
        currency(report.total_charges),
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
    footStyles: { fillColor: navy, textColor: [255, 255, 255], fontSize: 9 },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 65 },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 51, halign: "right" },
      3: { cellWidth: 42, halign: "right" },
    },
    didDrawPage: (data) => {
      if (data.cursor) summaryEnd = data.cursor.y;
    },
  });
  y = summaryEnd + 8;
  if (report.impediments.length) {
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(155, 45, 35);
    for (const line of doc.splitTextToSize(
      `Pendências: ${report.impediments.join(" ")}`,
      width,
    ) as string[]) {
      if (y > 263) {
        doc.addPage();
        y = 26;
      }
      doc.text(line, margin, y);
      y += 4;
    }
    y += 4;
  }
  if (y > 245) {
    doc.addPage();
    y = 27;
  }
  heading("02", "Extrato de despesas", y);
  const statementLines = periodReportLines(report);
  const difference =
    report.differences.reduce(
      (sum, item) => sum + Math.round(item.value * 100),
      0,
    ) / 100;
  autoTable(doc, {
    startY: y + 4,
    margin: { left: margin, right: margin, top: 23, bottom: 18 },
    head: [
      [
        "Descrição",
        "Tipo / destino",
        "Parcela",
        "Total despesa",
        "No período",
        "Por membro",
      ],
    ],
    body: statementLines.length
      ? statementLines.map((line) => [
          line.description,
          `${line.type === "individual" ? "Individual" : line.type === "acrescimo" ? "Acréscimo" : line.type === "rateio" ? "Rateio" : "Geral"}\n${line.type === "individual" ? "Responsável" : line.allocation}`,
          line.installment_number === null
            ? "Única"
            : `${line.installment_number}/${line.installments_count}`,
          currency(line.total_value),
          currency(line.value),
          line.allocated_value === null
            ? "Sem destinatários"
            : line.type === "geral"
              ? currency(0)
              : `${currency(line.allocated_value)}\n${line.divisor} ${line.divisor === 1 ? "membro" : "membros"}`,
        ])
      : [[{ content: "Nenhuma despesa neste período.", colSpan: 6 }]],
    foot: [
      ...(difference
        ? [
            [
              { content: "Diferença de rateio (não cobrada)", colSpan: 4 },
              currency(difference),
              "-",
            ],
          ]
        : []),
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
      fontSize: 8.5,
      cellPadding: 1.8,
      textColor: navy,
      lineColor: border,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: navy,
      textColor: [255, 255, 255],
      fontSize: 8,
      cellPadding: 2,
    },
    footStyles: { fillColor: pale, textColor: navy, cellPadding: 2 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 31 },
      2: { cellWidth: 15 },
      3: { cellWidth: 23, halign: "right" },
      4: { cellWidth: 23, halign: "right" },
      5: { cellWidth: 26, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "foot" && difference && data.row.index === 0) {
        data.cell.styles.fontStyle = "normal";
        data.cell.styles.fontSize = 7.5;
        data.cell.styles.textColor = [95, 95, 95];
        data.cell.styles.fillColor = [255, 255, 255];
      }
      if (
        data.section === "body" &&
        statementLines[data.row.index]?.type === "acrescimo"
      )
        data.cell.styles.fillColor = [245, 237, 219];
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
      doc.text(`Prestação de contas · Período ${report.sequence}`, margin, 14);
      doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(100);
      doc.text("Extrato de despesas · continuação", right, 14, {
        align: "right",
      });
      doc.setDrawColor(...border).line(margin, 18, right, 18);
    }
    doc.setDrawColor(...border).line(margin, 281, right, 281);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(100);
    doc.text(`Entre Colunas · Período ${report.sequence}`, margin, 286);
    doc.text(`${page} / ${pages}`, right, 286, { align: "right" });
  }
  return doc;
}

export function downloadPeriodReport(
  report: PeriodReport,
  lodgeName: string,
  details: PeriodReportMetadata,
) {
  buildPeriodReportPdf(report, lodgeName, details).save(
    `periodo-${report.sequence}-${report.status === "open" ? "previa" : "fechado"}.pdf`,
  );
}
