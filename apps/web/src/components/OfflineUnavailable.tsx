import { WifiOff } from "lucide-react";
import { EmptyState } from "@isnabero/ui";
import { useT } from "@/i18n";

// OfflineUnavailable: shown instead of a page that needs data we never loaded, rather than misleading zeros and empty states
export function OfflineUnavailable() {
  const { t } = useT();
  return <EmptyState icon={WifiOff} title={t("offline.unavailableTitle")} description={t("offline.unavailableHint")} className="min-h-[50vh]" />;
}
