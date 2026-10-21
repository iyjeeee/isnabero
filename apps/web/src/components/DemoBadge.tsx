import { getDataSource } from "@isnabero/db";
import { useT } from "@/i18n";

// DemoBadge: shown while the app runs on sample data (no Supabase), so nobody mistakes it for the real business
export function DemoBadge() {
  const { t } = useT();
  if (getDataSource() === "supabase") return null;
  return (
    <span title={t("nav.demoModeHint")} className="rounded bg-warning px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning-foreground">
      {t("nav.demoMode")}
    </span>
  );
}
