import type { OfferingWithInclusions } from "@isnabero/module-catalog";
import type { StockLevel } from "@isnabero/module-inventory";
import { Badge } from "@isnabero/ui";
import { StockBadge } from "@/components/inventory/StockBadge";
import { useLabels, useT } from "@/i18n";
import { formatPeso } from "@/lib/money";
import { DetailDialog } from "./DetailDialog";

export function OfferingDetailDialog({ offering, stock, onClose }: { offering: OfferingWithInclusions | null; stock: StockLevel | undefined; onClose: () => void }) {
  const { t } = useT();
  const labels = useLabels();
  if (!offering) return null;
  return (
    <DetailDialog
      open
      onClose={onClose}
      title={offering.name}
      description={t("details.titles.offering")}
      badges={
        <>
          <Badge variant="secondary">{labels.offeringType(offering.type)}</Badge>
          <Badge variant={offering.isAvailable ? "success" : "destructive"}>{offering.isAvailable ? t("catalog.page.available") : t("catalog.page.soldOut")}</Badge>
        </>
      }
      fields={[
        { label: t("details.fields.price"), value: <span className="font-display text-lg font-bold">{formatPeso(offering.price)}</span> },
        { label: t("details.fields.duration"), value: offering.durationMinutes ? t("details.minutes", { count: offering.durationMinutes }) : null },
        { label: t("details.fields.stock"), value: stock ? <StockBadge level={stock} /> : t("details.notTracked") },
        { label: t("details.fields.description"), value: offering.description, wide: true },
        {
          label: t("details.fields.inclusions"),
          value: offering.inclusions.length ? (
            <ul className="list-inside list-disc">
              {offering.inclusions.map((inclusion) => (
                <li key={inclusion.id}>
                  {inclusion.label}
                  {inclusion.quantity ? ` × ${inclusion.quantity}` : ""}
                </li>
              ))}
            </ul>
          ) : null,
          wide: true,
        },
      ]}
    />
  );
}
