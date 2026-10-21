import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BusinessSetupDialog } from "@/components/setup/BusinessSetupDialog";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageFallback } from "@/components/PageFallback";
import { OfflineBanner } from "@/components/OfflineBanner";
import { UpdateBanner } from "@/components/UpdateBanner";
import { OfflineUnavailable } from "@/components/OfflineUnavailable";
import { useOfflineUnavailable } from "@/hooks/use-offline-unavailable";
import { useOfflineSalesSync } from "@/lib/offline-sales/hooks";

export function AppLayout() {
  const { pathname } = useLocation();
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
      {/* flex-col: the top bar has a fixed height and does NOT scroll; only the content region below it
          scrolls (overflow-y-auto) — same "constrain then let the child scroll" pattern as the outer container. */}
      <main className="flex flex-1 flex-col overflow-hidden bg-background">
        <TopBar />

        <OfflineBanner />
        <UpdateBanner />

        <div className="flex-1 overflow-y-auto">
          {/* full width: wide screens get more columns (auto-fill grids), not a narrow centered strip with dead space either side */}
          <div className="w-full animate-fade-in px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
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
      <BusinessSetupDialog />
    </div>
  );
}
