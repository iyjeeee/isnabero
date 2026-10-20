import { useState } from "react";
import { Calculator } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardContent, ConfirmDialog, EmptyState, Input, Label, PageHeader, Skeleton, Textarea } from "@isnabero/ui";
import { useBusinessStore } from "@/stores/business-store";
import { useFormat, useT } from "@/i18n";
import { formatAmount, formatPeso } from "@/lib/money";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useCashCloseSummary, useCashCloses, useCloseCash } from "@/hooks/use-cash-close";
import { expectedCash, type CashCloseView } from "@/lib/repositories/repository";
import { useOfflineSalesStore } from "@/lib/offline-sales/queue-store";
import { CashDifferenceBadge } from "@/components/cash/CashDifferenceBadge";
import { CashCloseDetailDialog } from "@/components/details/CashCloseDetailDialog";
import { OPEN_CLASS, openProps } from "@/components/details/open-props";

// toAmount: "" or junk -> NaN so the form can tell "not typed yet" from zero
const toAmount = (text: string) => (text.trim() === "" ? NaN : Number(text));

export default function CashClosePage() {
  const { t } = useT();
  const format = useFormat();
  const online = useOnlineStatus();
  const businessId = useBusinessStore((state) => state.businessId) ?? "";
  const { data: summary, isLoading, isError } = useCashCloseSummary(businessId);
  const { data: closes = [], isLoading: closesLoading } = useCashCloses(businessId);
  const closeCash = useCloseCash(businessId);
  // waiting sales on this device would land in an already-closed period once they sync, so they must go first
  const hasWaitingSales = useOfflineSalesStore((state) => state.sales.some((sale) => sale.businessId === businessId && sale.status === "pending"));

  const [startingText, setStartingText] = useState<string | null>(null); // null = not edited: follow the last count
  const [countedText, setCountedText] = useState("");
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detail, setDetail] = useState<CashCloseView | null>(null);

  const startingValue = startingText ?? String(summary?.lastCounted ?? 0);
  const starting = toAmount(startingValue);
  const counted = toAmount(countedText);
  const expected = summary && Number.isFinite(starting) ? expectedCash(starting, summary.cashSales, summary.cashExpenses) : null;
  const difference = expected !== null && Number.isFinite(counted) ? Math.round((counted - expected) * 100) / 100 : null;
  const valid = expected !== null && Number.isFinite(counted) && starting >= 0 && counted >= 0;
  const blockedReason = !online ? t("cashClose.current.offline") : hasWaitingSales ? t("cashClose.current.waitingSales") : null;

  const submit = () => {
    closeCash.mutate(
      { openingFloat: starting, counted, note },
      {
        onSuccess: (result) => {
          const verdict = Math.abs(result.difference) < 0.005 ? t("cashClose.current.balanced") : result.difference < 0 ? t("cashClose.current.short", { amount: formatAmount(-result.difference) }) : t("cashClose.current.over", { amount: formatAmount(result.difference) });
          toast.success(t("cashClose.current.saved", { result: verdict }));
          setConfirmOpen(false);
          setStartingText(null);
          setCountedText("");
          setNote("");
        },
        onError: () => setConfirmOpen(false),
      },
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader icon={Calculator} title={t("cashClose.title")} description={t("cashClose.description")} />

      <Card>
        <CardContent className="space-y-5 p-5">
          <div>
            <h2 className="font-semibold">{t("cashClose.current.title")}</h2>
            {summary && <p className="text-sm text-muted-foreground">{t("cashClose.current.since", { when: format.dateTime(summary.periodStart) })}</p>}
          </div>
          {isLoading && <Skeleton className="h-40 w-full" />}
          {isError && <p className="text-sm text-destructive">{t("cashClose.current.loadFailed")}</p>}
          {summary && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="starting-cash">{t("cashClose.current.startingCash")}</Label>
                  <Input id="starting-cash" type="number" inputMode="decimal" min="0" step="0.01" value={startingValue} onChange={(event) => setStartingText(event.target.value)} />
                  <p className="text-xs text-muted-foreground">{t("cashClose.current.startingCashHint")}</p>
                </div>
                <dl className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
                  <div className="flex justify-between">
                    <dt>{t("cashClose.current.cashSales")}</dt>
                    <dd className="font-medium">{formatPeso(summary.cashSales)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>{t("cashClose.current.cashExpenses")}</dt>
                    <dd className="font-medium">−{formatPeso(summary.cashExpenses)}</dd>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-base font-semibold">
                    <dt>{t("cashClose.current.expected")}</dt>
                    <dd data-testid="expected-cash">{expected === null ? "—" : formatPeso(expected)}</dd>
                  </div>
                </dl>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="counted-cash">{t("cashClose.current.counted")}</Label>
                  <Input id="counted-cash" type="number" inputMode="decimal" min="0" step="0.01" value={countedText} onChange={(event) => setCountedText(event.target.value)} />
                  <p className="text-xs text-muted-foreground">{t("cashClose.current.countedHint")}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">{t("cashClose.current.difference")}</p>
                  <div className="flex h-10 items-center">{difference === null ? <span className="text-muted-foreground">—</span> : <CashDifferenceBadge difference={difference} />}</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="close-note">{t("cashClose.current.note")}</Label>
                <Textarea id="close-note" rows={2} maxLength={300} placeholder={t("cashClose.current.notePlaceholder")} value={note} onChange={(event) => setNote(event.target.value)} />
              </div>

              {blockedReason && (
                <p role="status" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
                  {blockedReason}
                </p>
              )}
              <Button disabled={!valid || blockedReason !== null || closeCash.isPending} onClick={() => setConfirmOpen(true)}>
                {t("cashClose.current.close")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="font-semibold">{t("cashClose.history.title")}</h2>
        <Card>
          <CardContent className="p-0">
            {closesLoading && (
              <div className="p-5">
                <Skeleton className="h-10 w-full" />
              </div>
            )}
            {!closesLoading && closes.length === 0 && <EmptyState icon={Calculator} title={t("cashClose.history.emptyTitle")} description={t("cashClose.history.emptyDescription")} className="border-0" />}
            {closes.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">{t("cashClose.history.when")}</th>
                      <th className="px-4 py-3">{t("cashClose.history.by")}</th>
                      <th className="px-4 py-3 text-right">{t("cashClose.history.expected")}</th>
                      <th className="px-4 py-3 text-right">{t("cashClose.history.counted")}</th>
                      <th className="px-4 py-3">{t("cashClose.history.difference")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closes.map((row) => (
                      <tr key={row.id} className={`border-b last:border-0 hover:bg-muted/40 ${OPEN_CLASS}`} {...openProps(() => setDetail(row))}>
                        <td className="px-4 py-3">{format.dateTime(row.periodEnd)}</td>
                        <td className="px-4 py-3">{row.closedByName}</td>
                        <td className="px-4 py-3 text-right">{formatPeso(row.expected)}</td>
                        <td className="px-4 py-3 text-right">{formatPeso(row.counted)}</td>
                        <td className="px-4 py-3">
                          <CashDifferenceBadge difference={row.difference} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("cashClose.current.confirmTitle")}
        description={t("cashClose.current.confirmDescription")}
        confirmLabel={t("cashClose.current.confirm")}
        variant="default"
        isPending={closeCash.isPending}
        onConfirm={submit}
      />
      <CashCloseDetailDialog close={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
