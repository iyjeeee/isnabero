import { useEffect, useRef } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useT } from "@/i18n";

// OfflineBanner: shown while the browser has no connection; confirms when it comes back
export function OfflineBanner() {
  const online = useOnlineStatus();
  const { t } = useT();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) wasOffline.current = true;
    else if (wasOffline.current) {
      wasOffline.current = false;
      toast.success(t("offline.backOnline"));
    }
  }, [online, t]);

  if (online) return null;
  return (
    <div role="status" className="flex shrink-0 items-start gap-3 border-b border-warning/40 bg-warning/15 px-4 py-2.5 text-sm">
      <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <p>
        <span className="font-medium">{t("offline.title")}</span> {t("offline.message")}
      </p>
    </div>
  );
}
