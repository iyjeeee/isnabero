import type { SupabaseClient } from "@supabase/supabase-js";
import { InsufficientStockError, stockStatus, type StockKind } from "@isnabero/db";
import type { InventoryRepository } from "./repository";
import type { StockLevel, StockMovementView } from "./types";
import { normalizeAdjustment, normalizeThreshold, normalizeTracking } from "./validation";

// Postgres codes: unique_violation (already tracked), check_violation (stock would go below zero — see migration 0006)
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

// Audit rows and the stock count itself are written by database triggers (migration 0005/0006), so none of these
// methods log or update counts directly — they only insert movements / tracking rows.
export function createSupabaseInventoryRepository(supabase: SupabaseClient): InventoryRepository {
  async function currentStock(businessId: string, offeringId: string): Promise<{ name: string; quantity: number }> {
    const { data, error } = await supabase
      .from("stock_items")
      .select("quantity, offerings(name)")
      .eq("business_id", businessId)
      .eq("offering_id", offeringId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("This item isn't tracked in inventory.");
    const offering = data.offerings as unknown as { name: string } | null;
    return { name: offering?.name ?? "this item", quantity: data.quantity };
  }

  return {
    async listStockLevels(businessId) {
      const { data, error } = await supabase
        .from("stock_items")
        .select("offering_id, quantity, low_stock_threshold, offerings(name, type)")
        .eq("business_id", businessId);
      if (error) throw error;
      return (data ?? [])
        .map((row): StockLevel => {
          const offering = row.offerings as unknown as { name: string; type: string } | null;
          return {
            offeringId: row.offering_id,
            offeringName: offering?.name ?? "Unknown offering",
            offeringType: offering?.type ?? "item",
            quantity: row.quantity,
            lowStockThreshold: row.low_stock_threshold,
            status: stockStatus(row.quantity, row.low_stock_threshold),
          };
        })
        .sort((a, b) => a.offeringName.localeCompare(b.offeringName));
    },

    async listMovements(businessId, options) {
      let query = supabase
        .from("stock_movements")
        .select("id, offering_id, delta, kind, note, created_at, offerings(name), employees(full_name)")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(options?.limit ?? 200);
      if (options?.offeringId) query = query.eq("offering_id", options.offeringId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row): StockMovementView => ({
        id: row.id,
        offeringId: row.offering_id,
        offeringName: (row.offerings as unknown as { name: string } | null)?.name ?? "Unknown offering",
        delta: row.delta,
        kind: row.kind as StockKind,
        note: row.note,
        recordedByName: (row.employees as unknown as { full_name: string } | null)?.full_name ?? null,
        createdAt: new Date(row.created_at),
      }));
    },

    async startTracking(businessId, input) {
      const clean = normalizeTracking(input);
      const { error } = await supabase
        .from("stock_items")
        .insert({ offering_id: clean.offeringId, business_id: businessId, quantity: 0, low_stock_threshold: clean.lowStockThreshold });
      if (error) throw error.code === UNIQUE_VIOLATION ? new Error("This item is already tracked.") : error;
      if (clean.quantity > 0) {
        const { error: moveError } = await supabase
          .from("stock_movements")
          .insert({ business_id: businessId, offering_id: clean.offeringId, delta: clean.quantity, kind: "initial", note: "Opening count", recorded_by: clean.recordedBy });
        if (moveError) throw moveError;
      }
    },

    async stopTracking(businessId, offeringId) {
      const { error } = await supabase.from("stock_items").delete().eq("business_id", businessId).eq("offering_id", offeringId);
      if (error) throw error;
    },

    async setLowStockThreshold(businessId, offeringId, threshold) {
      const clean = normalizeThreshold(threshold);
      const { error } = await supabase.from("stock_items").update({ low_stock_threshold: clean }).eq("business_id", businessId).eq("offering_id", offeringId);
      if (error) throw error;
    },

    async adjustStock(businessId, input) {
      const clean = normalizeAdjustment(input);
      const before = await currentStock(businessId, clean.offeringId);
      if (before.quantity + clean.delta < 0) throw new InsufficientStockError(before.name, before.quantity);
      const { error } = await supabase
        .from("stock_movements")
        .insert({ business_id: businessId, offering_id: clean.offeringId, delta: clean.delta, kind: clean.kind, note: clean.note, recorded_by: clean.recordedBy });
      // The pre-check above is for a friendly message; the CHECK constraint is what actually prevents a race from overselling
      if (error) throw error.code === CHECK_VIOLATION ? new InsufficientStockError(before.name, before.quantity) : error;
    },
  };
}
