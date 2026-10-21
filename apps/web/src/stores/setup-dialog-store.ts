import { create } from "zustand";

interface SetupDialogState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

// useSetupDialogStore: whether the Business Setup modal is open. Anything can open it (Settings, the dashboard checklist,
// a "module is off" screen, the first-run prompt) without navigating anywhere.
export const useSetupDialogStore = create<SetupDialogState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
