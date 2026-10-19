import { useState } from "react";
import { Button } from "@isnabero/ui";
import { useT } from "@/i18n";
import { OfferingFormModal } from "./OfferingFormModal";

interface CreateOfferingModalProps {
  businessId: string;
}

// CreateOfferingModal: the "Add offering" button plus the shared offering form in create mode
export function CreateOfferingModal({ businessId }: CreateOfferingModalProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("catalog.form.addButton")}</Button>
      <OfferingFormModal businessId={businessId} open={open} onOpenChange={setOpen} />
    </>
  );
}
