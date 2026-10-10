import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label } from "@isnabero/ui";
import { exportToCsv } from "@/lib/export-csv";
import { buildPdf } from "@/lib/export-pdf";
import { toLocalYmd, validateDateRange, type DateRange } from "@/lib/date-range";
import type { CsvRow } from "@/lib/export-rows";
import { useBusinessStore } from "@/stores/business-store";
import { useBusiness } from "@/hooks/use-business";

interface ExportButtonProps {
  title: string; // PDF heading, e.g. "Expenses"
  filenamePrefix: string; // e.g. "expenses" -> expenses-2026-10-09.csv / .pdf (plus the range when one is set)
  buildRows: (range: DateRange) => CsvRow[];
  withDateRange?: boolean; // ask for an optional From/To
  moneyColumns?: string[]; // PDF only: columns shown as "PHP 1,234.00" and right-aligned
  hint?: string; // one line under the description, e.g. "Uses the filters currently applied."
  disabled?: boolean;
}

// ExportButton: one export UX for every list page. Opens a small dialog: optional From/To (both blank = everything), a
// live row count, then CSV or PDF. CSV is for spreadsheets, PDF for printing or sharing.
export function ExportButton({ title, filenamePrefix, buildRows, withDateRange = false, moneyColumns, hint, disabled }: ExportButtonProps) {
  const businessId = useBusinessStore((state) => state.businessId) ?? "";
  const { data: business } = useBusiness(businessId);
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange>({});
  const [pdfPending, setPdfPending] = useState(false);

  const rangeError = validateDateRange(range);
  // Only computed while the dialog is open (it shows the live row count)
  const rows = open && !rangeError ? buildRows(withDateRange ? range : {}) : [];

  const today = toLocalYmd(new Date());
  const hasRange = Boolean(range.from || range.to);
  const suffix = withDateRange && hasRange ? `${range.from || "start"}_to_${range.to || today}` : today;
  const rangeLabel = withDateRange ? (hasRange ? `${range.from || "Start"} to ${range.to || "today"}` : "All dates") : undefined;

  const handleCsv = () => {
    exportToCsv(`${filenamePrefix}-${suffix}.csv`, rows);
    toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"} to CSV`);
    setOpen(false);
  };

  const handlePdf = async () => {
    setPdfPending(true);
    try {
      const doc = await buildPdf({ title, businessName: business?.name ?? "Isnabero", subtitle: rangeLabel, rows, moneyColumns });
      doc.save(`${filenamePrefix}-${suffix}.pdf`);
      toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"} to PDF`);
      setOpen(false);
    } catch {
      toast.error("Couldn't create the PDF. Please try again.");
    } finally {
      setPdfPending(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setRange({});
          setOpen(true);
        }}
        disabled={disabled}
      >
        <Download className="h-4 w-4" />
        Export
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export {title}</DialogTitle>
            <DialogDescription>
              {withDateRange ? "Pick dates to limit the export, or leave both blank to export everything." : "Download what's listed on this page."}
              {hint ? ` ${hint}` : ""}
            </DialogDescription>
          </DialogHeader>
          {withDateRange && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="export-from">From</Label>
                <Input id="export-from" type="date" max={range.to || undefined} value={range.from ?? ""} onChange={(event) => setRange({ ...range, from: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="export-to">To</Label>
                <Input id="export-to" type="date" min={range.from || undefined} value={range.to ?? ""} onChange={(event) => setRange({ ...range, to: event.target.value })} />
              </div>
            </div>
          )}
          <p className={rangeError ? "text-sm text-destructive" : "text-sm text-muted-foreground"} role="status">
            {rangeError ?? `${rows.length} row${rows.length === 1 ? "" : "s"} will be exported.`}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="outline" onClick={handlePdf} disabled={rows.length === 0 || pdfPending}>
              <FileText className="h-4 w-4" />
              {pdfPending ? "Creating…" : "Download PDF"}
            </Button>
            <Button type="button" onClick={handleCsv} disabled={rows.length === 0 || pdfPending}>
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
