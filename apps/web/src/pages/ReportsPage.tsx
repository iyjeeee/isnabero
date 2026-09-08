import { BarChart3 } from "lucide-react";
import { PageHeader } from "@isnabero/ui";
import { useBusinessStore } from "@/stores/business-store";
import { useBusinessModules } from "@/hooks/use-business-modules";
import { SalesReportSection } from "@/components/reports/SalesReportSection";
import { BookingReportSection } from "@/components/reports/BookingReportSection";
import { CatalogReportSection } from "@/components/reports/CatalogReportSection";

// Each report renders only if its module is enabled for this business — same "only show what's
// relevant" pattern as the sidebar itself. Full-width sections since charts need real room, unlike
// the small preview cards this page used before real report data existed.
export default function ReportsPage() {
  const businessId = useBusinessStore((state) => state.businessId) ?? "";
  const { data: enabledModules = [] } = useBusinessModules(businessId);

  const hasAnyReport = enabledModules.includes("pos") || enabledModules.includes("booking") || enabledModules.includes("catalog");

  return (
    <div className="space-y-6">
      <PageHeader icon={BarChart3} title="Reports" description="Sales, bookings, and catalog performance for this business." />

      {!hasAnyReport && (
        <p className="text-sm text-muted-foreground">Enable a module like POS, Booking, or Catalog to see its report here.</p>
      )}

      {enabledModules.includes("pos") && <SalesReportSection businessId={businessId} />}
      {enabledModules.includes("booking") && <BookingReportSection businessId={businessId} />}
      {enabledModules.includes("catalog") && <CatalogReportSection businessId={businessId} />}
    </div>
  );
}
