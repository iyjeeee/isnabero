import { Menu, Store } from "lucide-react";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useBusinessStore } from "@/stores/business-store";
import { SettingsDialog } from "@/components/SettingsDialog";
import { SignOutButton } from "@/components/SignOutButton";
import { useT } from "@/i18n";

// same look as the sidebar's own icon buttons so the two navy surfaces read as one frame
const ICON_BUTTON = "flex h-9 w-9 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground";

// TopBar: navy like the sidebar; holds only Settings (language, theme, business setup in a modal) and Sign out
export function TopBar() {
  const setMobileOpen = useSidebarStore((state) => state.setMobileOpen);
  const businessName = useBusinessStore((state) => state.businessName);
  const { t } = useT();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground sm:px-6">
      {/* Hamburger + business name — mobile only; on desktop the sidebar is always visible and carries both */}
      <button onClick={() => setMobileOpen(true)} aria-label={t("nav.openMenu")} className={`${ICON_BUTTON} md:hidden`}>
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex min-w-0 items-center gap-2 md:hidden">
        <Store className="h-4 w-4 shrink-0 text-primary-foreground" />
        <p className="truncate font-display text-sm font-semibold">{businessName ?? "Isnabero"}</p>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <SettingsDialog triggerClassName={ICON_BUTTON} />
        <SignOutButton className={ICON_BUTTON} />
      </div>
    </header>
  );
}
