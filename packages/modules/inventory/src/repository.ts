import type { AdjustStockInput, ListMovementsOptions, StartTrackingInput, StockLevel, StockMovementView } from "./types";

// InventoryRepository: stock is only ever changed through movements (adjustStock, or a POS sale), never set directly,
// so the ledger always explains the count. Rejects (throws) rather than going below zero.
export interface InventoryRepository {
  listStockLevels(businessId: string): Promise<StockLevel[]>;
  listMovements(businessId: string, options?: ListMovementsOptions): Promise<StockMovementView[]>;
  // startTracking: makes an offering tracked with an opening count (recorded as an "initial" movement)
  startTracking(businessId: string, input: StartTrackingInput): Promise<void>;
  // stopTracking: the offering becomes untracked again; its movement history is kept
  stopTracking(businessId: string, offeringId: string): Promise<void>;
  setLowStockThreshold(businessId: string, offeringId: string, threshold: number): Promise<void>;
  adjustStock(businessId: string, input: AdjustStockInput): Promise<void>;
}
