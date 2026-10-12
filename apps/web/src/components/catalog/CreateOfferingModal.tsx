import { useState } from "react";
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
import { useCreateOfferingWithInclusions } from "@isnabero/module-catalog";
import { supabase } from "@/lib/supabase";
import { useT, useLabels } from "@/i18n";
import { offeringFormSchema, type OfferingFormValues } from "./offering-form-schema";

interface CreateOfferingModalProps {
  businessId: string;
}

export function CreateOfferingModal({ businessId }: CreateOfferingModalProps) {
  const { t, tm } = useT();
  const labels = useLabels();
  const [open, setOpen] = useState(false);
  const createOffering = useCreateOfferingWithInclusions(supabase, businessId);

  const form = useForm<OfferingFormValues>({
    resolver: zodResolver(offeringFormSchema),
    defaultValues: { name: "", description: "", type: "item", price: 0, durationMinutes: undefined, inclusions: [] },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "inclusions" });
  const offeringType = form.watch("type");

  const onSubmit = form.handleSubmit((values) => {
    createOffering.mutate(
      {
        offering: {
          name: values.name,
          description: values.description || null,
          type: values.type,
          price: String(values.price),
          durationMinutes: values.durationMinutes ?? null,
          isAvailable: true,
        },
        inclusions:
          values.type === "bundle"
            ? values.inclusions.map((inclusion) => ({ label: inclusion.label, quantity: inclusion.quantity ?? null }))
            : [],
      },
      {
        onSuccess: () => {
          toast.success(t("catalog.form.added", { name: values.name }));
          form.reset();
          setOpen(false);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>{t("catalog.form.addButton")}</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("catalog.form.title")}</DialogTitle>
          <DialogDescription>{t("catalog.form.description")}</DialogDescription>
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={createOffering.isPending}>
              {createOffering.isPending ? t("common.saving") : t("catalog.form.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
