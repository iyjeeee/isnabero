import type { offerings, offeringInclusions } from "@isnabero/db";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

// Offering: a row as read from the database (item / bundle / addon)
export type Offering = InferSelectModel<typeof offerings>;
// NewOffering: shape required to insert a new offering (id/createdAt are auto-generated)
export type NewOffering = InferInsertModel<typeof offerings>;

// OfferingInclusion: one line of "what's included" on a bundle, e.g. "10 mins unli shots"
export type OfferingInclusion = InferSelectModel<typeof offeringInclusions>;
export type NewOfferingInclusion = InferInsertModel<typeof offeringInclusions>;

// OfferingWithInclusions: an offering plus its bundle inclusions — the shape the UI actually renders
export type OfferingWithInclusions = Offering & { inclusions: OfferingInclusion[] };
