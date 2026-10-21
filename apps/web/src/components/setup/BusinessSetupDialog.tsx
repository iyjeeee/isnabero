import { useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Skeleton } from "@isnabero/ui";
import { useT } from "@/i18n";
import { useBusinessStore } from "@/stores/business-store";
import { useSetupDialogStore } from "@/stores/setup-dialog-store";
import { useBusiness } from "@/hooks/use-business";
import { useBusinessModules } from "@/hooks/use-business-modules";
import { useCan } from "@/hooks/use-permission";
import { SetupWizard } from "@/components/setup/SetupWizard";
import { ReceiptDetailsForm } from "@/components/receipt/ReceiptDetailsForm";

// prompted: the first-run prompt shows once per page load, so closing it with "X" isn't undone by a re-render
let prompted = false;

// BusinessSetupDialog: business name, modules and receipt details in one modal. Opens on its own the first time an owner/admin
// uses a business that hasn't finished setup; afterwards it is opened from Settings (or the dashboard checklist).
export function BusinessSetupDialog() {
  const { t } = useT();
  const open = useSetupDialogStore((state) => state.open);
  const setOpen = useSetupDialogStore((state) => state.setOpen);
  const businessId = useBusinessStore((state) => state.businessId);
  const canConfigure = useCan()("business.configure");
  const { data: business, isLoading: businessLoading } = useBusiness(businessId);
  const { data: enabledModules, isLoading: modulesLoading } = useBusinessModules(businessId);
  const isFirstRun = business ? business.setupCompletedAt === null : false;

  useEffect(() => {
    if (!prompted && isFirstRun && canConfigure) {
      prompted = true;
      setOpen(true);
    }
  }, [isFirstRun, canConfigure, setOpen]);

  if (!canConfigure) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isFirstRun ? t("setup.welcomeTitle") : t("nav.setup")}</DialogTitle>
          <DialogDescription>{isFirstRun ? t("setup.welcomeDescription") : t("setup.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {(businessLoading || modulesLoading) && <Skeleton className="h-56 w-full rounded-xl" />}
          {/* key: remount with fresh initial values if the business changes while this is open */}
          {business && enabledModules && <SetupWizard key={business.id} business={business} enabledModules={enabledModules} onDone={() => setOpen(false)} />}
          {/* After first-run setup only, so the wizard stays three short steps */}
          {business && !isFirstRun && (
            <div className="border-t pt-5">
              <ReceiptDetailsForm key={`receipt-${business.id}`} business={business} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
