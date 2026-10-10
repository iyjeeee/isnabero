import { z } from "zod";

// blankToUndefined: HTML number inputs yield "" when empty, and z.coerce.number() turns "" into 0 —
// which would save "no duration" / "unlimited" as a literal 0. Map blanks to undefined first.
const optionalPositiveInt = (message: string) =>
  z.preprocess((value) => (value === "" || value === null ? undefined : value), z.coerce.number().int(message).positive(message).optional());

// offeringFormSchema: validates the Add Offering form — inclusions are only meaningful for bundles,
// so they're always optional at the schema level and just hidden in the UI for item/addon types.
export const offeringFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().optional(),
  type: z.enum(["item", "bundle", "addon"]),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  durationMinutes: optionalPositiveInt("Duration must be a whole number of minutes"),
  inclusions: z.array(
    z.object({
      label: z.string().trim().min(1, "Inclusion label is required"),
      quantity: optionalPositiveInt("Quantity must be a whole number (leave blank for unlimited)"),
    }),
  ),
});

export type OfferingFormValues = z.infer<typeof offeringFormSchema>;
