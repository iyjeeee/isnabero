import { Badge } from "@isnabero/ui";
import type { StockLevel } from "@isnabero/module-inventory";
import { useLabels, useT } from "@/i18n";

// StockBadge: the one place stock status is turned into a label + colour (Inventory, Catalog and Dashboard share it)
export function StockBadge({ level }: { level: Pick<StockLevel, "status" | "quantity"> }) {
  const { t } = useT();
  const labels = useLabels();
  if (level.status === "out") return <Badge variant="destructive">{labels.stockStatus("out")}</Badge>;
  if (level.status === "low") return <Badge variant="warning">{t("inventory.badge.low", { quantity: level.quantity })}</Badge>;
  return <Badge variant="success">{t("inventory.badge.inStock", { quantity: level.quantity })}</Badge>;
}
