import { z } from "zod";
import { MAX_STOCK_QUANTITY } from "@isnabero/db";
import { MAX_NOTE_LENGTH } from "@isnabero/module-inventory";

// Counts stay strings in the forms (z.coerce.number() would turn a blank box into 0, see offering-form-schema.ts)
const wholeNumber = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((value) => /^\d+$/.test(value), `${label} must be a whole number`)
    .refine((value) => Number(value) <= MAX_STOCK_QUANTITY, `${label} is too large`);

export const trackItemSchema = z.object({
  offeringId: z.string().min(1, "Choose an item"),
  quantity: wholeNumber("Starting quantity"),
  lowStockThreshold: wholeNumber("Low-stock level"),
});
export type TrackItemValues = z.infer<typeof trackItemSchema>;

export const settingsSchema = z.object({ lowStockThreshold: wholeNumber("Low-stock level") });
export type SettingsValues = z.infer<typeof settingsSchema>;

export const adjustSchema = z
  .object({
    kind: z.enum(["restock", "return", "correction", "damage"]),
    quantity: wholeNumber("Quantity"),
    note: z.string().trim().min(1, "Add a short reason").max(MAX_NOTE_LENGTH, `Keep it under ${MAX_NOTE_LENGTH} characters`),
  })
  .superRefine((values, ctx) => {
    // "Correction" means "the count I just made", so 0 is a valid answer; every other kind adds or removes at least 1
    if (values.kind !== "correction" && values.quantity !== "" && Number(values.quantity) === 0) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "Enter at least 1" });
    }
  });
export type AdjustValues = z.infer<typeof adjustSchema>;

// computeDelta: the signed change to record. Correction takes the counted quantity and works out the difference.
export function computeDelta(kind: AdjustValues["kind"], quantity: number, currentQuantity: number): number {
  if (kind === "correction") return quantity - currentQuantity;
  return kind === "damage" ? -quantity : quantity;
}
