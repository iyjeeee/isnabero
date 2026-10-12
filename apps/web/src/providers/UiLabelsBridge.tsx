import { useMemo, type ReactNode } from "react";
import { UiLabelsProvider, type UiLabels } from "@isnabero/ui";
import { useT } from "@/i18n";

// UiLabelsBridge: feeds translated strings to the shared components in packages/ui
export function UiLabelsBridge({ children }: { children: ReactNode }) {
  const { t } = useT();
  const labels = useMemo<UiLabels>(
    () => ({
      close: t("ui.close"),
      cancel: t("ui.cancel"),
      confirm: t("ui.confirm"),
      pleaseWait: t("ui.pleaseWait"),
      prev: t("ui.prev"),
      next: t("ui.next"),
      quantity: t("ui.quantity"),
      trendLabel: t("ui.trendLabel"),
      trendNoData: (label) => t("ui.trendNoData", { label }),
      decreaseQuantity: t("ui.decreaseQuantity"),
      increaseQuantity: t("ui.increaseQuantity"),
      showingRange: (start, end, total) => t("ui.showingRange", { start, end, total }),
      pageOf: (page, total) => t("ui.pageOf", { page, total }),
    }),
    [t],
  );
  return <UiLabelsProvider labels={labels}>{children}</UiLabelsProvider>;
}
