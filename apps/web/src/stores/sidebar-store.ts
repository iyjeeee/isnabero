import { create } from "zustand";

const STORAGE_KEY = "isnabero-sidebar-collapsed";

function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

interface SidebarState {
  collapsed: boolean;
  toggleCollapsed: () => void;
  // mobileOpen: whether the off-canvas drawer is open on mobile viewports. Deliberately NOT persisted
  // to localStorage (unlike `collapsed`) — a drawer should always start closed on page load, not
  // remember being left open from a previous session.
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
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
  mobileOpen: false,
  setMobileOpen: (open) => set({ mobileOpen: open }),
}));
