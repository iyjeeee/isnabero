import { Rocket } from "lucide-react";
import { PageHeader, Skeleton } from "@isnabero/ui";
import { useBusinessStore } from "@/stores/business-store";
import { useBusiness } from "@/hooks/use-business";
import { useBusinessModules } from "@/hooks/use-business-modules";
import { SetupWizard } from "@/components/setup/SetupWizard";
import { ReceiptDetailsCard } from "@/components/receipt/ReceiptDetailsCard";

export default function SetupPage() {
  const businessId = useBusinessStore((state) => state.businessId);
  const { data: business, isLoading: businessLoading } = useBusiness(businessId);
  const { data: enabledModules, isLoading: modulesLoading } = useBusinessModules(businessId);
  const isFirstRun = business ? business.setupCompletedAt === null : false;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        icon={Rocket}
        title={isFirstRun ? "Welcome — let's set up your business" : "Business Setup"}
        description={isFirstRun ? "Three quick steps to tailor Isnabero to how you work." : "Update your business name and the modules you use."}
      />
      {(businessLoading || modulesLoading) && <Skeleton className="h-72 w-full rounded-xl" />}
      {/* key: remount with fresh initial values if the business changes while this page is open */}
      {business && enabledModules && <SetupWizard key={business.id} business={business} enabledModules={enabledModules} />}
      {/* After first-run setup only, so the wizard stays three short steps */}
      {business && !isFirstRun && <ReceiptDetailsCard key={`receipt-${business.id}`} business={business} />}
    </div>
  );
}
