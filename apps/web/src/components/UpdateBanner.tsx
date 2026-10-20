import { RefreshCw } from "lucide-react";
import { Button } from "@isnabero/ui";
import { useT } from "@/i18n";
import { applyUpdate, useUpdateStore } from "@/lib/offline/update-store";

// UpdateBanner: shown when a newer version of the installed app has downloaded; the person picks when to switch
export function UpdateBanner() {
  const { t } = useT();
  const waiting = useUpdateStore((state) => state.waiting);
  const dismissed = useUpdateStore((state) => state.dismissed);
  const dismiss = useUpdateStore((state) => state.dismiss);
  if (!waiting || dismissed) return null;
  return (
    <div role="status" className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-info/40 bg-info/10 px-4 py-2.5 text-sm">
      <p className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 shrink-0 text-info" />
        <span>
          <span className="font-medium">{t("update.title")}</span> {t("update.message")}
        </span>
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={applyUpdate}>
          {t("update.now")}
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss}>
          {t("update.later")}
        </Button>
      </div>
    </div>
  );
}
