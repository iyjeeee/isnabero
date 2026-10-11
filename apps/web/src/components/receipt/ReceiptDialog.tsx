import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Download, Printer } from "lucide-react";
import { useReceipt, type ReceiptRef } from "@isnabero/module-pos";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Skeleton } from "@isnabero/ui";
import { supabase } from "@/lib/supabase";
import { buildReceiptPdf, receiptPdfFilename } from "@/lib/receipt-pdf";
import { receiptTitle } from "@/lib/receipt-format";
import { ReceiptSheet } from "@/components/receipt/ReceiptSheet";

interface ReceiptDialogProps {
  businessId: string;
  reference: ReceiptRef | null; // null = closed
  onClose: () => void;
}

// ReceiptDialog: shows a sale's receipt with Print and Download PDF. Printing uses a hidden copy rendered straight into
// <body> (see .receipt-print-root in index.css) so only the receipt reaches the printer, never the app around it.
export function ReceiptDialog({ businessId, reference, onClose }: ReceiptDialogProps) {
  const { data: receipt, isLoading, isError } = useReceipt(supabase, businessId, reference);
  const [pdfPending, setPdfPending] = useState(false);

  const handlePdf = async () => {
    if (!receipt) return;
    setPdfPending(true);
    try {
      (await buildReceiptPdf(receipt)).save(receiptPdfFilename(receipt));
    } catch {
      toast.error("Couldn't create the PDF. Please try again.");
    } finally {
      setPdfPending(false);
    }
  };

  return (
    <Dialog open={reference !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{receipt ? receiptTitle(receipt) : "Receipt"}</DialogTitle>
          <DialogDescription>Print it for the customer or save a copy as a PDF.</DialogDescription>
        </DialogHeader>

        {isLoading && <Skeleton className="h-72 w-full" />}
        {(isError || (!isLoading && !receipt)) && <p className="py-6 text-center text-sm text-muted-foreground">No receipt found for this payment.</p>}
        {receipt && (
          <div className="rounded-md border bg-neutral-100 p-3 dark:bg-neutral-800">
            <ReceiptSheet receipt={receipt} className="shadow-sm" />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="outline" onClick={handlePdf} disabled={!receipt || pdfPending}>
            <Download className="mr-2 h-4 w-4" />
            {pdfPending ? "Preparing…" : "Download PDF"}
          </Button>
          <Button onClick={() => window.print()} disabled={!receipt}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
      {reference !== null && receipt && createPortal(<div className="receipt-print-root"><ReceiptSheet receipt={receipt} /></div>, document.body)}
    </Dialog>
  );
}
