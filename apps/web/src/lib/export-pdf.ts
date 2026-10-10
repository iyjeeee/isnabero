import type { CsvRow } from "@/lib/export-rows";

export interface PdfOptions {
  title: string; // e.g. "Expenses"
  businessName: string;
  subtitle?: string; // e.g. the date range
  rows: CsvRow[];
  moneyColumns?: string[]; // columns formatted as money and right-aligned
}

const MONEY = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// formatPdfCell: PDF fonts can't draw the ₱ sign, so money is written as "PHP 1,234.00" (numbers elsewhere stay as-is)
export function formatPdfCell(value: string | number, isMoney: boolean): string {
  if (isMoney && typeof value === "number") return `PHP ${MONEY.format(value)}`;
  return String(value);
}

// buildPdf: a table PDF (header with business + title, striped table, page numbers). jsPDF is loaded on demand so it
// stays out of the main bundle. Wide tables switch to landscape.
export async function buildPdf({ title, businessName, subtitle, rows, moneyColumns = [] }: PdfOptions) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const headers = Object.keys(rows[0] ?? {});
  const doc = new jsPDF({ orientation: headers.length > 6 ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(businessName, 40, 44);
  doc.setFontSize(12);
  doc.text(title, 40, 64);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text([subtitle, `Generated ${new Date().toLocaleString()}`].filter(Boolean).join("  ·  "), 40, 80);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 94,
    head: [headers],
    body: rows.map((row) => headers.map((header) => formatPdfCell(row[header] ?? "", moneyColumns.includes(header)))),
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [40, 44, 52] },
    alternateRowStyles: { fillColor: [245, 245, 247] },
    columnStyles: Object.fromEntries(headers.map((header, index) => [index, moneyColumns.includes(header) ? { halign: "right" as const } : {}])),
    didParseCell: (data) => {
      // column styles only cover the body, so right-align money headers too
      if (data.section === "head" && moneyColumns.includes(headers[data.column.index] ?? "")) data.cell.styles.halign = "right";
    },
    margin: { left: 40, right: 40, bottom: 40 },
    didDrawPage: () => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Page ${page}`, pageWidth - 40, doc.internal.pageSize.getHeight() - 20, { align: "right" });
      doc.setTextColor(0);
    },
  });
  return doc;
}
