import { z } from "zod";
import { MAX_STOCK_QUANTITY } from "@isnabero/db";
import { MAX_NOTE_LENGTH } from "@isnabero/module-inventory";
import { msg } from "@/i18n";

// Counts stay strings in the forms (z.coerce.number() would turn a blank box into 0, see offering-form-schema.ts)
const wholeNumber = (field: "startingQuantity" | "lowStockLevel" | "quantity") =>
  z
    .string()
    .trim()
    .min(1, msg(`inventory.validation.${field}.required`))
    .refine((value) => /^\d+$/.test(value), msg(`inventory.validation.${field}.whole`))
    .refine((value) => Number(value) <= MAX_STOCK_QUANTITY, msg(`inventory.validation.${field}.tooLarge`));

export const trackItemSchema = z.object({
  offeringId: z.string().min(1, msg("inventory.validation.chooseItem")),
  quantity: wholeNumber("startingQuantity"),
  lowStockThreshold: wholeNumber("lowStockLevel"),
});
export type TrackItemValues = z.infer<typeof trackItemSchema>;

export const settingsSchema = z.object({ lowStockThreshold: wholeNumber("lowStockLevel") });
export type SettingsValues = z.infer<typeof settingsSchema>;

export const adjustSchema = z
  .object({
    kind: z.enum(["restock", "return", "correction", "damage"]),
    quantity: wholeNumber("quantity"),
    note: z.string().trim().min(1, msg("inventory.validation.addReason")).max(MAX_NOTE_LENGTH, msg("inventory.validation.noteTooLong", { max: MAX_NOTE_LENGTH })),
  })
  .superRefine((values, ctx) => {
    // "Correction" means "the count I just made", so 0 is a valid answer; every other kind adds or removes at least 1
    if (values.kind !== "correction" && values.quantity !== "" && Number(values.quantity) === 0) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: msg("inventory.validation.atLeastOne") });
    }
  });
export type AdjustValues = z.infer<typeof adjustSchema>;

// computeDelta: the signed change to record. Correction takes the counted quantity and works out the difference.
export function computeDelta(kind: AdjustValues["kind"], quantity: number, currentQuantity: number): number {
  if (kind === "correction") return quantity - currentQuantity;
  return kind === "damage" ? -quantity : quantity;
}
