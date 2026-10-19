import { create } from "zustand";
import { DEMO_BUSINESS_ID, getDataSource } from "@isnabero/db";

interface BusinessState {
  businessId: string | null;
  businessName: string | null;
  setBusiness: (id: string, name: string) => void;
  clearBusiness: () => void;
}

// useBusinessStore: mock mode starts on the seeded demo business (same id as packages/db's mock store and supabase/seed.sql)
// so every page has data to render. Supabase mode starts empty — AuthProvider sets it from the signed-in employee's
// business (getMembership) and clears it on sign-out.
const isMock = getDataSource() === "mock";

export const useBusinessStore = create<BusinessState>((set) => ({
  businessId: isMock ? DEMO_BUSINESS_ID : null,
  businessName: isMock ? "Sample Business" : null,
  setBusiness: (id, name) => set({ businessId: id, businessName: name }),
  clearBusiness: () => set({ businessId: null, businessName: null }),
}));
