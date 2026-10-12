import { describe, expect, it } from "vitest";
import { msg } from "@/i18n";
import { offeringFormSchema } from "../offering-form-schema";

const base = { name: "Bundle A", type: "bundle" as const, price: "499", inclusions: [] };

describe("offeringFormSchema", () => {
  it("treats a blank duration as not set (undefined), not 0", () => {
    const parsed = offeringFormSchema.parse({ ...base, durationMinutes: "" });
    expect(parsed.durationMinutes).toBeUndefined();
  });

  it("treats a blank inclusion quantity as unlimited (undefined), not 0", () => {
    const parsed = offeringFormSchema.parse({ ...base, inclusions: [{ label: "Unli shots", quantity: "" }] });
    expect(parsed.inclusions[0]?.quantity).toBeUndefined();
  });

  it("keeps real numeric values", () => {
    const parsed = offeringFormSchema.parse({ ...base, durationMinutes: "10", inclusions: [{ label: "Prints", quantity: "2" }] });
    expect(parsed.durationMinutes).toBe(10);
    expect(parsed.inclusions[0]?.quantity).toBe(2);
  });

  it("rejects zero/negative/fractional durations and blank names", () => {
    expect(offeringFormSchema.safeParse({ ...base, durationMinutes: "0" }).success).toBe(false);
    expect(offeringFormSchema.safeParse({ ...base, durationMinutes: "-5" }).success).toBe(false);
    expect(offeringFormSchema.safeParse({ ...base, durationMinutes: "1.5" }).success).toBe(false);
    expect(offeringFormSchema.safeParse({ ...base, name: "   " }).success).toBe(false);
  });

  it("reports validation errors as message tokens", () => {
    const blankName = offeringFormSchema.safeParse({ ...base, name: "   " });
    expect(blankName.success ? [] : blankName.error.issues.map((issue) => issue.message)).toContain(msg("catalog.validation.nameRequired"));
    const badDuration = offeringFormSchema.safeParse({ ...base, durationMinutes: "1.5" });
    expect(badDuration.success ? [] : badDuration.error.issues.map((issue) => issue.message)).toContain(msg("catalog.validation.durationInt"));
  });
});
