import { useState } from "react";
import { ChevronRight, Moon, Settings, Sun } from "lucide-react";
import { cn, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@isnabero/ui";
import { SETTINGS_ENTRY } from "@/lib/nav-config";
import { useCan } from "@/hooks/use-permission";
import { useThemeStore } from "@/stores/theme-store";
import { useSetupDialogStore } from "@/stores/setup-dialog-store";
import { useT } from "@/i18n";

// Choice: one option of a segmented control, marked with aria-pressed so state isn't shown by color alone
function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground shadow-card" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Row({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </p>
      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">{children}</div>
    </div>
  );
}

// SettingsDialog: the top-bar settings button and the modal it opens — theme and a link to Business Setup
export function SettingsDialog({ triggerClassName }: { triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const { t } = useT();
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const can = useCan();
  const openSetup = useSetupDialogStore((state) => state.setOpen);
  const SetupIcon = SETTINGS_ENTRY.icon;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title={t("nav.settings")} aria-label={t("nav.settings")} className={triggerClassName}>
        <Settings className="h-4 w-4" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("nav.settings")}</DialogTitle>
            <DialogDescription>{t("nav.settingsHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <Row icon={theme === "dark" ? Moon : Sun} label={t("nav.theme")}>
              <Choice active={theme === "light"} onClick={() => setTheme("light")}>
                <Sun className="h-4 w-4" />
                {t("nav.themeLight")}
              </Choice>
              <Choice active={theme === "dark"} onClick={() => setTheme("dark")}>
                <Moon className="h-4 w-4" />
                {t("nav.themeDark")}
              </Choice>
            </Row>
            {can(SETTINGS_ENTRY.permission) && (
              <button type="button" onClick={() => { setOpen(false); openSetup(true); }} className="group flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/50">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <SetupIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t(SETTINGS_ENTRY.labelKey)}</p>
                  <p className="truncate text-xs text-muted-foreground">{t("nav.setupHint")}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
