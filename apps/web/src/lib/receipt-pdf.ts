import { formatReceiptNumber, type Receipt } from "@isnabero/module-pos";
import { RECEIPT_DISCLAIMER, receiptDateTime, receiptMethodLabel } from "@/lib/receipt-format";

const WIDTH = 80; // mm — a common thermal-roll width
const MARGIN = 5;
const LINE = 4.2;

// PDF fonts can't draw ₱, so money is written "PHP 1,234.00" (same rule as the table exports)
const MONEY = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pdfMoney = (amount: number) => `PHP ${MONEY.format(amount)}`;

type Doc = InstanceType<typeof import("jspdf").jsPDF>;

// drawReceipt: lays the receipt out on `doc` and returns the y it ended at (so a first pass can size the page)
function drawReceipt(doc: Doc, receipt: Receipt): number {
  const inner = WIDTH - MARGIN * 2;
  let y = MARGIN + 3;

  const center = (text: string, opts: { bold?: boolean; size?: number; gray?: boolean } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 8);
    doc.setTextColor(opts.gray ? 110 : 0);
    for (const line of doc.splitTextToSize(text, inner) as string[]) {
      doc.text(line, WIDTH / 2, y, { align: "center" });
      y += LINE;
    }
  };
  const row = (left: string, right: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text(right, WIDTH - MARGIN, y, { align: "right" });
    const leftLines = doc.splitTextToSize(left, inner - doc.getTextWidth(right) - 2) as string[];
    for (const line of leftLines) {
      doc.text(line, MARGIN, y);
      y += LINE;
    }
  };
  const rule = () => {
    doc.setDrawColor(150);
    doc.setLineDashPattern([0.6, 0.8], 0);
    doc.line(MARGIN, y - 2.4, WIDTH - MARGIN, y - 2.4);
    doc.setLineDashPattern([], 0);
    y += 1.2;
  };

  const { business } = receipt;
  center(business.name, { bold: true, size: 11 });
  if (business.address) center(business.address, { gray: true });
  if (business.contactNumber) center(`Tel: ${business.contactNumber}`, { gray: true });
  if (business.tin) center(`TIN: ${business.tin}`, { gray: true });
  y += 1;
  rule();
  center(`Receipt No. ${formatReceiptNumber(receipt.receiptNumber)}`, { bold: true });
  center(receiptDateTime(receipt.issuedAt), { gray: true });
  if (receipt.cashierName) center(`Cashier: ${receipt.cashierName}`, { gray: true });
  if (receipt.voided) center("*** VOIDED ***", { bold: true, size: 10 });
  rule();
  for (const line of receipt.lines) {
    row(`${line.quantity} x ${line.name}`, pdfMoney(line.amount));
    doc.setTextColor(110);
    doc.text(`@ ${pdfMoney(line.unitPrice)}`, MARGIN + 3, y);
    y += LINE;
  }
  rule();
  row("TOTAL", pdfMoney(receipt.total), true);
  row(`Paid by ${receiptMethodLabel(receipt.method)}`, "");
  if (receipt.referenceCode) row(`Ref: ${receipt.referenceCode}`, "");
  y += 1;
  rule();
  if (business.footer) center(business.footer, { bold: true });
  center(RECEIPT_DISCLAIMER, { gray: true, size: 7 });
  return y + MARGIN;
}

// buildReceiptPdf: an 80 mm-wide, one-page receipt PDF. jsPDF loads on demand (same as the table exports).
export async function buildReceiptPdf(receipt: Receipt): Promise<Doc> {
  const { jsPDF } = await import("jspdf");
  const height = drawReceipt(new jsPDF({ unit: "mm", format: [WIDTH, 400] }), receipt); // measuring pass
  // jsPDF flips a page that is wider than tall into landscape, so the page is never shorter than it is wide
  const doc = new jsPDF({ unit: "mm", format: [WIDTH, Math.max(height, WIDTH + 10)] });
  drawReceipt(doc, receipt);
  return doc;
}

export const receiptPdfFilename = (receipt: Receipt) => `receipt-${formatReceiptNumber(receipt.receiptNumber)}.pdf`;
