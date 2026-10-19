import { formatDelta, type StockLevel, type StockMovementView } from "@isnabero/module-inventory";
import { Badge, cn } from "@isnabero/ui";
import { StockBadge } from "@/components/inventory/StockBadge";
import { useFormat, useLabels, useT } from "@/i18n";
import { DetailDialog } from "./DetailDialog";

// StockItemDetailDialog: one tracked item — its count, warning level and its most recent stock changes
export function StockItemDetailDialog({ level, movements, onClose }: { level: StockLevel | null; movements: StockMovementView[]; onClose: () => void }) {
  const { t } = useT();
  const format = useFormat();
  const labels = useLabels();
  if (!level) return null;
  const recent = movements.filter((movement) => movement.offeringId === level.offeringId).slice(0, 8);
  return (
    <DetailDialog
      open
      onClose={onClose}
      title={level.offeringName}
      description={t("details.titles.stockItem")}
      badges={<StockBadge level={level} />}
      fields={[
        { label: t("details.fields.type"), value: labels.offeringType(level.offeringType) },
        { label: t("details.fields.stock"), value: <span className="font-display text-lg font-bold tabular-nums">{level.quantity}</span> },
        { label: t("details.fields.warnAt"), value: level.lowStockThreshold > 0 ? level.lowStockThreshold : null },
        { label: t("details.fields.tracked"), value: t("details.tracking") },
      ]}
    >
      <div className="mt-5">
        <h3 className="mb-2 text-sm font-semibold">{t("details.recentChanges")}</h3>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("details.noChanges")}</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {recent.map((movement) => (
              <li key={movement.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate">{labels.stockKind(movement.kind)}{movement.note ? ` — ${movement.note}` : ""}</p>
                  <p className="text-xs text-muted-foreground">{format.dateTime(movement.createdAt)} · {movement.recordedByName ?? t("inventory.history.system")}</p>
                </div>
                <span className={cn("shrink-0 font-medium tabular-nums", movement.delta > 0 ? "text-success" : "text-destructive")}>{formatDelta(movement.delta)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DetailDialog>
  );
}

// MovementDetailDialog: one line of the stock history, with the full reason
export function MovementDetailDialog({ movement, onClose }: { movement: StockMovementView | null; onClose: () => void }) {
  const { t } = useT();
  const format = useFormat();
  const labels = useLabels();
  if (!movement) return null;
  return (
    <DetailDialog
      open
      onClose={onClose}
      title={movement.offeringName}
      description={t("details.titles.movement")}
      badges={<Badge variant={movement.kind === "sale" ? "info" : "secondary"}>{labels.stockKind(movement.kind)}</Badge>}
      fields={[
        { label: t("details.fields.change"), value: <span className={cn("font-display text-lg font-bold tabular-nums", movement.delta > 0 ? "text-success" : "text-destructive")}>{formatDelta(movement.delta)}</span> },
        { label: t("details.fields.when"), value: format.dateTime(movement.createdAt) },
        { label: t("details.fields.who"), value: movement.recordedByName ?? t("inventory.history.system") },
        { label: t("details.fields.reason"), value: movement.note, wide: true },
      ]}
    />
  );
}
