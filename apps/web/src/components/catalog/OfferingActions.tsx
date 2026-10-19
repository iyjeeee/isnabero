import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionIconButton, ConfirmDialog } from "@isnabero/ui";
import { useDeleteOffering, type OfferingWithInclusions } from "@isnabero/module-catalog";
import { supabase } from "@/lib/supabase";
import { useT } from "@/i18n";
import { OfferingFormModal } from "./OfferingFormModal";

interface OfferingActionsProps {
  businessId: string;
  offering: OfferingWithInclusions;
}

// OfferingActions: edit and delete buttons on a catalog card. Deleting is refused (with a clear message) once sales or bookings use the offering.
export function OfferingActions({ businessId, offering }: OfferingActionsProps) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteOffering = useDeleteOffering(supabase, businessId);

  return (
    <div className="flex items-center gap-1.5">
      <ActionIconButton action="edit" icon={Pencil} onClick={() => setEditing(true)} aria-label={t("catalog.page.edit", { name: offering.name })} />
      <ActionIconButton action="delete" icon={Trash2} onClick={() => setDeleting(true)} aria-label={t("catalog.page.delete", { name: offering.name })} />

      <OfferingFormModal businessId={businessId} open={editing} onOpenChange={setEditing} offering={offering} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("catalog.deleteDialog.title")}
        description={t("catalog.deleteDialog.description", { name: offering.name })}
        confirmLabel={t("catalog.deleteDialog.confirm")}
        isPending={deleteOffering.isPending}
        onConfirm={() =>
          deleteOffering.mutate(offering.id, {
            onSuccess: () => {
              toast.success(t("catalog.page.deleted", { name: offering.name }));
              setDeleting(false);
            },
            onError: () => setDeleting(false), // the error toast explains why (e.g. it has sales)
          })
        }
      />
    </div>
  );
}
