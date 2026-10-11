import { formatReceiptNumber, type Receipt } from "@isnabero/module-pos";
import { cn } from "@isnabero/ui";
import { RECEIPT_DISCLAIMER, receiptDateTime, receiptMethodLabel, receiptMoney } from "@/lib/receipt-format";

// ReceiptSheet: the receipt itself. Always black on white (it's paper), so it looks the same in dark mode and when printed.
export function ReceiptSheet({ receipt, className }: { receipt: Receipt; className?: string }) {
  const { business } = receipt;
  return (
    <div className={cn("receipt-sheet mx-auto w-full max-w-[22rem] bg-white p-5 font-mono text-[13px] leading-snug text-black", className)}>
      <div className="space-y-0.5 text-center">
        <p className="text-base font-bold">{business.name}</p>
        {business.address && <p className="text-neutral-600">{business.address}</p>}
        {business.contactNumber && <p className="text-neutral-600">Tel: {business.contactNumber}</p>}
        {business.tin && <p className="text-neutral-600">TIN: {business.tin}</p>}
      </div>

      <hr className="my-3 border-dashed border-neutral-400" />
      <div className="space-y-0.5 text-center">
        <p className="font-bold">Receipt No. {formatReceiptNumber(receipt.receiptNumber)}</p>
        <p className="text-neutral-600">{receiptDateTime(receipt.issuedAt)}</p>
        {receipt.cashierName && <p className="text-neutral-600">Cashier: {receipt.cashierName}</p>}
        {receipt.voided && <p className="pt-1 text-base font-bold">*** VOIDED ***</p>}
      </div>

      <hr className="my-3 border-dashed border-neutral-400" />
      <ul className="space-y-1.5">
        {receipt.lines.map((line, index) => (
          <li key={index}>
            <div className="flex justify-between gap-3">
              <span>
                {line.quantity} × {line.name}
              </span>
              <span className="shrink-0">{receiptMoney(line.amount)}</span>
            </div>
            <p className="pl-4 text-xs text-neutral-500">@ {receiptMoney(line.unitPrice)}</p>
          </li>
        ))}
      </ul>

      <hr className="my-3 border-dashed border-neutral-400" />
      <div className="flex justify-between text-base font-bold">
        <span>TOTAL</span>
        <span>{receiptMoney(receipt.total)}</span>
      </div>
      <p className="mt-1">Paid by {receiptMethodLabel(receipt.method)}</p>
      {receipt.referenceCode && <p>Ref: {receipt.referenceCode}</p>}

      <hr className="my-3 border-dashed border-neutral-400" />
      <div className="space-y-1 text-center">
        {business.footer && <p className="font-bold">{business.footer}</p>}
        <p className="text-[11px] text-neutral-500">{RECEIPT_DISCLAIMER}</p>
      </div>
    </div>
  );
}
