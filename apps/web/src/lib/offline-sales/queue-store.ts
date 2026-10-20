import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PendingSale } from "./types";

// safeStorage: localStorage when it works; otherwise nothing is saved (private windows, blocked site data) but the queue still works in memory
const safeStorage = {
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // storage full or blocked: keep going in memory
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // nothing to remove
    }
  },
};

interface QueueState {
  sales: PendingSale[];
  enqueue: (sale: Omit<PendingSale, "status" | "attempts">) => void;
  remove: (clientId: string) => void;
  markFailed: (clientId: string, error: string) => void;
  markRetry: (clientId: string) => void; // back to pending (a person pressed "Try again")
  touch: (clientId: string) => void; // one more attempt made
}

// useOfflineSalesStore: sales waiting to be sent, saved on this device so they survive a reload or a closed tab
export const useOfflineSalesStore = create<QueueState>()(
  persist(
    (set) => ({
      sales: [],
      enqueue: (sale) =>
        set((state) => (state.sales.some((item) => item.clientId === sale.clientId) ? state : { sales: [...state.sales, { ...sale, status: "pending", attempts: 0 }] })),
      remove: (clientId) => set((state) => ({ sales: state.sales.filter((sale) => sale.clientId !== clientId) })),
      markFailed: (clientId, error) => set((state) => ({ sales: state.sales.map((sale) => (sale.clientId === clientId ? { ...sale, status: "failed", error } : sale)) })),
      markRetry: (clientId) => set((state) => ({ sales: state.sales.map((sale) => (sale.clientId === clientId ? { ...sale, status: "pending", error: undefined } : sale)) })),
      touch: (clientId) => set((state) => ({ sales: state.sales.map((sale) => (sale.clientId === clientId ? { ...sale, attempts: sale.attempts + 1 } : sale)) })),
    }),
    { name: "isnabero-pending-sales", version: 1, storage: createJSONStorage(() => safeStorage), partialize: (state) => ({ sales: state.sales }) },
  ),
);

// pendingQuantities: how many of each offering are waiting to be sent for a business — shown stock is reduced by these
export function pendingQuantities(sales: PendingSale[], businessId: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const sale of sales) {
    if (sale.businessId !== businessId || sale.status === "failed") continue; // a refused sale no longer holds stock
    for (const line of sale.lines) totals.set(line.id, (totals.get(line.id) ?? 0) + line.quantity);
  }
  return totals;
}
