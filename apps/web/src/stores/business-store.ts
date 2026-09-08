import { create } from "zustand";
import { DEMO_BUSINESS_ID } from "@isnabero/db";

interface BusinessState {
  businessId: string | null;
  businessName: string | null;
  setBusiness: (id: string, name: string) => void;
}

// useBusinessStore: defaults to the seeded demo business (same id used in packages/db's mock store AND
// supabase/seed.sql) so every page has real data to render before auth/business-switching is built.
// Once login is wired up, setBusiness should be called with the employee's actual business_id instead.
export const useBusinessStore = create<BusinessState>((set) => ({
  businessId: DEMO_BUSINESS_ID,
  businessName: "Sample Business",
  setBusiness: (id, name) => set({ businessId: id, businessName: name }),
}));
