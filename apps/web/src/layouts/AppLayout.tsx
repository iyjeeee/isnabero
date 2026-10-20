import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu, Store } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useBusinessStore } from "@/stores/business-store";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageFallback } from "@/components/PageFallback";
import { useT } from "@/i18n";
import { OfflineBanner } from "@/components/OfflineBanner";
import { UpdateBanner } from "@/components/UpdateBanner";
import { OfflineUnavailable } from "@/components/OfflineUnavailable";
import { useOfflineUnavailable } from "@/hooks/use-offline-unavailable";
import { useOfflineSalesSync } from "@/lib/offline-sales/hooks";

export function AppLayout() {
  const setMobileOpen = useSidebarStore((state) => state.setMobileOpen);
  const businessName = useBusinessStore((state) => state.businessName);
  const { pathname } = useLocation();
  const { t } = useT();
  const offlineUnavailable = useOfflineUnavailable();
  useOfflineSalesSync(); // sends sales rung up offline whenever the app is open, on any page

  return (
    // h-screen + overflow-hidden (NOT min-h-screen) is required here: it constrains this container to
    // exactly the viewport height, which is what lets the scrollable content area below create its own
    // internal scrollbar. Without this, a page taller than the viewport made the whole document scroll
    // instead — and since Sidebar isn't fixed/sticky on desktop, it would scroll away with the page,
    // leaving blank space where it used to be. Do not change this back to min-h-screen.
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      {/* flex-col: the mobile top bar has a fixed height and does NOT scroll; only the content region
          below it scrolls (overflow-y-auto) — same "constrain then let the child scroll" pattern as the
          outer container above, applied one level deeper for the mobile header. */}
      <main className="flex flex-1 flex-col overflow-hidden bg-background">
        {/* Mobile-only top bar with hamburger menu — hidden entirely on desktop (md:hidden), since the
            sidebar is always visible there and there's nothing to open. */}
        <div className="flex shrink-0 items-center gap-3 border-b bg-card px-4 py-3 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label={t("nav.openMenu")}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <Store className="h-4 w-4 shrink-0 text-primary" />
            <p className="truncate font-display text-sm font-semibold">{businessName ?? "Isnabero"}</p>
          </div>
        </div>

        <OfflineBanner />
        <UpdateBanner />

        <div className="flex-1 overflow-y-auto">
          <div className="w-full animate-fade-in px-4 py-6 sm:px-6 sm:py-8 lg:px-10 xl:px-14">
            <ErrorBoundary resetKey={pathname}>
              {/* Suspense here (not only in App.tsx) so the sidebar stays mounted while a lazy page chunk loads */}
              {offlineUnavailable && <OfflineUnavailable />}
              {/* stays mounted (just hidden) so its queries resume the moment the connection returns */}
              <div hidden={offlineUnavailable}>
                <Suspense fallback={<PageFallback />}>
                  <Outlet />
                </Suspense>
              </div>
            </ErrorBoundary>
          </div>
        </div>
      </main>
    </div>
  );
}
