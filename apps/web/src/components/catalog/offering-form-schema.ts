import { z } from "zod";
import { msg } from "@/i18n";

// blankToUndefined: HTML number inputs yield "" when empty, and z.coerce.number() turns "" into 0 —
// which would save "no duration" / "unlimited" as a literal 0. Map blanks to undefined first.
const optionalPositiveInt = (message: string) =>
  z.preprocess((value) => (value === "" || value === null ? undefined : value), z.coerce.number().int(message).positive(message).optional());

// offeringFormSchema: validates the Add Offering form — inclusions are only meaningful for bundles,
// so they're always optional at the schema level and just hidden in the UI for item/addon types.
export const offeringFormSchema = z.object({
  name: z.string().trim().min(1, msg("catalog.validation.nameRequired")),
  description: z.string().optional(),
  type: z.enum(["item", "bundle", "addon"]),
  price: z.coerce.number().min(0, msg("catalog.validation.priceMin")),
  durationMinutes: optionalPositiveInt(msg("catalog.validation.durationInt")),
  inclusions: z.array(
    z.object({
      label: z.string().trim().min(1, msg("catalog.validation.inclusionLabelRequired")),
      quantity: optionalPositiveInt(msg("catalog.validation.inclusionQuantityInt")),
    }),
  ),
});

export type OfferingFormValues = z.infer<typeof offeringFormSchema>;
