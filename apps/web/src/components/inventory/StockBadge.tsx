import { Badge } from "@isnabero/ui";
import type { StockLevel } from "@isnabero/module-inventory";

// StockBadge: the one place stock status is turned into a label + colour (Inventory, Catalog and Dashboard share it)
export function StockBadge({ level }: { level: Pick<StockLevel, "status" | "quantity"> }) {
  if (level.status === "out") return <Badge variant="destructive">Out of stock</Badge>;
  if (level.status === "low") return <Badge variant="warning">Low · {level.quantity} left</Badge>;
  return <Badge variant="success">{level.quantity} in stock</Badge>;
}
