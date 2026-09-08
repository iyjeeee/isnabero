import { create } from "zustand";
import type { CartLine } from "./types";
import type { OfferingWithInclusions } from "@isnabero/module-catalog";

interface CartState {
  lines: CartLine[];
  addOffering: (offering: OfferingWithInclusions) => void;
  updateQuantity: (offeringId: string, quantity: number) => void;
  removeLine: (offeringId: string) => void;
  clear: () => void;
  total: () => number;
}

// useCartStore: holds the active POS cart in memory — cleared on checkout success, never persisted to disk
export const useCartStore = create<CartState>((set, get) => ({
  lines: [],
  addOffering: (offering) =>
    set((state) => {
      const existing = state.lines.find((line) => line.offering.id === offering.id);
      if (existing) {
        return {
          lines: state.lines.map((line) =>
            line.offering.id === offering.id ? { ...line, quantity: line.quantity + 1 } : line,
          ),
        };
      }
      return { lines: [...state.lines, { offering, quantity: 1 }] };
    }),
  updateQuantity: (offeringId, quantity) =>
    set((state) => ({
      lines: state.lines
        .map((line) => (line.offering.id === offeringId ? { ...line, quantity } : line))
        .filter((line) => line.quantity > 0),
    })),
  removeLine: (offeringId) =>
    set((state) => ({ lines: state.lines.filter((line) => line.offering.id !== offeringId) })),
  clear: () => set({ lines: [] }),
  total: () => get().lines.reduce((sum, line) => sum + Number(line.offering.price) * line.quantity, 0),
}));
