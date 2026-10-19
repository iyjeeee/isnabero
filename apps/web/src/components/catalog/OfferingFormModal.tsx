import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Textarea,
  Label,
  Select,
} from "@isnabero/ui";
import { useCreateOfferingWithInclusions, useUpdateOffering, type OfferingWithInclusions } from "@isnabero/module-catalog";
import { supabase } from "@/lib/supabase";
import { useT, useLabels } from "@/i18n";
import { offeringFormSchema, type OfferingFormValues } from "./offering-form-schema";

interface OfferingFormModalProps {
  businessId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offering?: OfferingWithInclusions; // present = edit this offering, absent = add a new one
}

const EMPTY_VALUES: OfferingFormValues = { name: "", description: "", type: "item", price: 0, durationMinutes: undefined, inclusions: [] };

// OfferingFormModal: one form for adding and editing an offering (controlled — CreateOfferingModal and OfferingActions own the open state)
export function OfferingFormModal({ businessId, open, onOpenChange, offering }: OfferingFormModalProps) {
  const { t, tm } = useT();
  const labels = useLabels();
  const createOffering = useCreateOfferingWithInclusions(supabase, businessId);
  const updateOffering = useUpdateOffering(supabase, businessId);
  const isEdit = Boolean(offering);
  const isPending = createOffering.isPending || updateOffering.isPending;

  const form = useForm<OfferingFormValues>({
    resolver: zodResolver(offeringFormSchema),
    defaultValues: EMPTY_VALUES,
  });

  // Fill the form from the offering being edited (or blank it for a new one) each time the dialog opens
  useEffect(() => {
    if (!open) return;
    form.reset(
      offering
        ? {
            name: offering.name,
            description: offering.description ?? "",
            type: offering.type,
            price: Number(offering.price),
            durationMinutes: offering.durationMinutes ?? undefined,
            inclusions: offering.inclusions.map((inclusion) => ({ label: inclusion.label, quantity: inclusion.quantity ?? undefined })),
          }
        : EMPTY_VALUES,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens or a different offering is edited
  }, [open, offering?.id]);

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "inclusions" });
  const offeringType = form.watch("type");

  const onSubmit = form.handleSubmit((values) => {
    const input = {
      offering: {
        name: values.name,
        description: values.description || null,
        type: values.type,
        price: String(values.price),
        durationMinutes: values.durationMinutes ?? null,
        isAvailable: offering?.isAvailable ?? true, // editing never flips the sold-out toggle
      },
      inclusions:
        values.type === "bundle"
          ? values.inclusions.map((inclusion) => ({ label: inclusion.label, quantity: inclusion.quantity ?? null }))
          : [],
    };
    const done = (message: string) => ({
      onSuccess: () => {
        toast.success(message);
        onOpenChange(false);
      },
    });
    if (offering) updateOffering.mutate({ offeringId: offering.id, input }, done(t("catalog.form.updated", { name: values.name })));
    else createOffering.mutate(input, done(t("catalog.form.added", { name: values.name })));
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("catalog.form.editTitle") : t("catalog.form.title")}</DialogTitle>
          <DialogDescription>{isEdit ? t("catalog.form.editDescription") : t("catalog.form.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t("catalog.form.name")}</Label>
            <Input id="name" placeholder={t("catalog.form.namePlaceholder")} {...form.register("name")} />
            {form.formState.errors.name && <p className="text-xs text-destructive">{tm(form.formState.errors.name.message)}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">{t("catalog.form.descriptionLabel")}</Label>
            <Textarea id="description" placeholder={t("catalog.form.descriptionPlaceholder")} {...form.register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="type">{t("catalog.form.type")}</Label>
              <Select id="type" {...form.register("type")}>
                <option value="item">{labels.offeringType("item")}</option>
                <option value="bundle">{labels.offeringType("bundle")}</option>
                <option value="addon">{labels.offeringType("addon")}</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">{t("catalog.form.price")}</Label>
              <Input id="price" type="number" step="0.01" min="0" {...form.register("price")} />
              {form.formState.errors.price && <p className="text-xs text-destructive">{tm(form.formState.errors.price.message)}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="durationMinutes">{t("catalog.form.duration")}</Label>
            <Input id="durationMinutes" type="number" min="0" placeholder={t("catalog.form.durationPlaceholder")} {...form.register("durationMinutes")} />
          </div>

          {offeringType === "bundle" && (
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <Label>{t("catalog.form.inclusions")}</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ label: "", quantity: undefined })}>
                  <Plus className="mr-1 h-3 w-3" /> {t("catalog.form.addInclusion")}
                </Button>
              </div>
              {fields.length === 0 && <p className="text-xs text-muted-foreground">{t("catalog.form.inclusionsHint")}</p>}
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <Input placeholder={t("catalog.form.inclusionLabelPlaceholder")} {...form.register(`inclusions.${index}.label` as const)} />
                  <Input
                    className="w-24"
                    type="number"
                    min="0"
                    placeholder={t("catalog.form.inclusionQuantityPlaceholder")}
                    {...form.register(`inclusions.${index}.quantity` as const)}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label={t("catalog.form.removeInclusion")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("common.saving") : isEdit ? t("catalog.form.saveChanges") : t("catalog.form.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
