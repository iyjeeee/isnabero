import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label } from "@isnabero/ui";
import { exportToCsv } from "@/lib/export-csv";
import { toLocalYmd, validateDateRange, type DateRange } from "@/lib/date-range";

type CsvRow = Record<string, string | number>;

interface ExportCsvButtonProps {
  filenamePrefix: string; // e.g. "expenses" -> expenses-2026-10-09.csv (plus the range when one is set)
  buildRows: (range: DateRange) => CsvRow[];
  withDateRange?: boolean; // ask for an optional From/To before downloading
  hint?: string; // one line under the description, e.g. "Uses the filters currently applied."
  disabled?: boolean;
}

// ExportCsvButton: one export UX for every list page. Without a date range it downloads straight away; with one it
// opens a small dialog (both dates optional = everything) that shows how many rows will be exported.
export function ExportCsvButton({ filenamePrefix, buildRows, withDateRange = false, hint, disabled }: ExportCsvButtonProps) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange>({});

  const rangeError = validateDateRange(range);
  // Only computed while the dialog is open (it shows the live row count); the no-dialog path builds rows on click
  const rows = withDateRange && open && !rangeError ? buildRows(range) : [];

  const download = (toExport: CsvRow[], suffix: string) => {
    if (toExport.length === 0) return;
    exportToCsv(`${filenamePrefix}-${suffix}.csv`, toExport);
    toast.success(`Exported ${toExport.length} row${toExport.length === 1 ? "" : "s"}`);
  };

  const today = toLocalYmd(new Date());
  const handleClick = () => {
    if (withDateRange) {
      setRange({});
      setOpen(true);
    } else {
      download(buildRows({}), today);
    }
  };
  const handleDownload = () => {
    const suffix = range.from || range.to ? `${range.from || "start"}_to_${range.to || today}` : today;
    download(rows, suffix);
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" onClick={handleClick} disabled={disabled}>
        <Download className="h-4 w-4" />
        Export CSV
      </Button>
      {withDateRange && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export CSV</DialogTitle>
              <DialogDescription>Pick dates to limit the export, or leave both blank to export everything.{hint ? ` ${hint}` : ""}</DialogDescription>
            </DialogHeader>
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
            <p className={rangeError ? "text-sm text-destructive" : "text-sm text-muted-foreground"} role="status">
              {rangeError ?? `${rows.length} row${rows.length === 1 ? "" : "s"} will be exported.`}
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleDownload} disabled={rows.length === 0}>
                <Download className="h-4 w-4" />
                Download
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
