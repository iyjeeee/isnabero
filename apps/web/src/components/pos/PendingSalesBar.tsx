import { useState } from "react";
import { CloudUpload, RefreshCw, Trash2 } from "lucide-react";
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@isnabero/ui";
import { useT, useFormat, useLabels } from "@/i18n";
import { formatPeso } from "@/lib/money";
import { useBusinessStore } from "@/stores/business-store";
import { useOfflineSalesStore } from "@/lib/offline-sales/queue-store";
import { useOnlineStatus } from "@/hooks/use-online-status";

// PendingSalesBar: shows sales waiting on this device to be sent (and any the server refused); opens a list to retry or discard them
export function PendingSalesBar() {
  const { t } = useT();
  const format = useFormat();
  const labels = useLabels();
  const online = useOnlineStatus();
  const businessId = useBusinessStore((state) => state.businessId);
  const allSales = useOfflineSalesStore((state) => state.sales);
  const { remove, markRetry } = useOfflineSalesStore.getState();
  const [open, setOpen] = useState(false);

  const sales = allSales.filter((sale) => sale.businessId === businessId);
  if (sales.length === 0) return null;
  const failed = sales.filter((sale) => sale.status === "failed").length;
  const waiting = sales.length - failed;

  return (
    <>
      <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-info/40 bg-info/10 px-4 py-2.5 text-sm">
        <p className="flex items-center gap-2">
          <CloudUpload className="h-4 w-4 shrink-0 text-info" />
          <span>
            {waiting > 0 && t("offlineSales.bar.waiting", { count: waiting })}
            {waiting > 0 && failed > 0 && " · "}
            {failed > 0 && t("offlineSales.bar.failed", { count: failed })}
          </span>
        </p>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          {t("offlineSales.bar.review")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("offlineSales.dialog.title")}</DialogTitle>
            <DialogDescription>{online ? t("offlineSales.dialog.descriptionOnline") : t("offlineSales.dialog.descriptionOffline")}</DialogDescription>
          </DialogHeader>
          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {sales.map((sale) => (
              <li key={sale.clientId} className="space-y-1.5 rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{formatPeso(sale.total)}</span>
                  <Badge variant={sale.status === "failed" ? "destructive" : "info"}>{t(sale.status === "failed" ? "offlineSales.status.failed" : "offlineSales.status.waiting")}</Badge>
                </div>
                <p className="text-muted-foreground">
                  {sale.lines.map((line) => `${line.quantity}× ${line.name}`).join(", ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format.dateTime(new Date(sale.soldAt))} · {labels.method(sale.method)}
                </p>
                {sale.status === "failed" && (
                  <div className="space-y-2">
                    <p className="text-xs text-destructive">{sale.error}</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markRetry(sale.clientId)} // back to waiting; the sync in the app layout picks it up at once
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        {t("offlineSales.dialog.retry")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(sale.clientId)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("offlineSales.dialog.discard")}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
