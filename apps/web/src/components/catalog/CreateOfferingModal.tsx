import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

// offeringFormSchema: validates the Add Offering form — inclusions are only meaningful for bundles,
// so they're always optional at the schema level and just hidden in the UI for item/addon types.
const offeringFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  type: z.enum(["item", "bundle", "addon"]),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  durationMinutes: z.coerce.number().int().min(0).optional(),
  inclusions: z.array(z.object({ label: z.string().min(1, "Inclusion label is required"), quantity: z.coerce.number().int().min(0).optional() })),
});

type OfferingFormValues = z.infer<typeof offeringFormSchema>;

interface CreateOfferingModalProps {
  businessId: string;
}

export function CreateOfferingModal({ businessId }: CreateOfferingModalProps) {
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
          toast.success(`${values.name} added to catalog`);
          form.reset();
          setOpen(false);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>Add offering</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add offering</DialogTitle>
          <DialogDescription>Create a menu item, package bundle, or add-on for POS and Booking.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g. Sisig, Bundle A" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" placeholder="Short description shown on the catalog card" {...form.register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <Select id="type" {...form.register("type")}>
                <option value="item">Item</option>
                <option value="bundle">Bundle</option>
                <option value="addon">Add-on</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">Price (₱)</Label>
              <Input id="price" type="number" step="0.01" min="0" {...form.register("price")} />
              {form.formState.errors.price && <p className="text-xs text-destructive">{form.formState.errors.price.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="durationMinutes">Duration in minutes (optional — set this if it can be booked as a time slot)</Label>
            <Input id="durationMinutes" type="number" min="0" placeholder="e.g. 10" {...form.register("durationMinutes")} />
          </div>

          {offeringType === "bundle" && (
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <Label>Inclusions</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ label: "", quantity: undefined })}>
                  <Plus className="mr-1 h-3 w-3" /> Add inclusion
                </Button>
              </div>
              {fields.length === 0 && <p className="text-xs text-muted-foreground">e.g. "Unli shots", "Printed copies (2)"</p>}
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <Input placeholder="Label" {...form.register(`inclusions.${index}.label` as const)} />
                  <Input
                    className="w-24"
                    type="number"
                    min="0"
                    placeholder="Qty (unli)"
                    {...form.register(`inclusions.${index}.quantity` as const)}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createOffering.isPending}>
              {createOffering.isPending ? "Saving…" : "Save offering"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
