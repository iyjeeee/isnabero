import { create } from "zustand";

const STORAGE_KEY = "isnabero-sidebar-collapsed";

function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

interface SidebarState {
  collapsed: boolean;
  toggleCollapsed: () => void;
}

// useSidebarStore: controls whether the sidebar shows icon+label or icon-only, for maximizing page
// content width on demand. Persists across reloads, independent of the light/dark theme setting.
export const useSidebarStore = create<SidebarState>((set, get) => ({
  collapsed: getInitialCollapsed(),
  toggleCollapsed: () => {
    const next = !get().collapsed;
    localStorage.setItem(STORAGE_KEY, String(next));
    set({ collapsed: next });
  },
}));
