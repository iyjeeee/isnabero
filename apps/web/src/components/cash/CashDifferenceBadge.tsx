import { Badge } from "@isnabero/ui";
import { useT } from "@/i18n";
import { formatAmount } from "@/lib/money";

// CashDifferenceBadge: balanced / short / over, in words as well as colour
export function CashDifferenceBadge({ difference }: { difference: number }) {
  const { t } = useT();
  if (Math.abs(difference) < 0.005) return <Badge variant="success">{t("cashClose.current.balanced")}</Badge>;
  if (difference < 0) return <Badge variant="destructive">{t("cashClose.current.short", { amount: formatAmount(-difference) })}</Badge>;
  return <Badge variant="warning">{t("cashClose.current.over", { amount: formatAmount(difference) })}</Badge>;
}
