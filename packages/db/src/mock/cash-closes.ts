import type { InferSelectModel } from "drizzle-orm";
import type { cashCloses } from "../schema";

export type CashCloseRow = InferSelectModel<typeof cashCloses>;

// cashCloseRows: the mock cash_closes table (kept out of store.ts so it can't disturb the seeded data's rng order)
export const cashCloseRows: CashCloseRow[] = [];
