import { create } from "zustand";

interface UpdateState {
  waiting: ServiceWorker | null; // a downloaded new version waiting for the person to accept it
  dismissed: boolean; // "Later" hides the bar until the next page load
  setWaiting: (worker: ServiceWorker | null) => void;
  dismiss: () => void;
}

// useUpdateStore: whether a newer version of the app is ready to install
export const useUpdateStore = create<UpdateState>((set) => ({
  waiting: null,
  dismissed: false,
  setWaiting: (waiting) => set({ waiting, dismissed: false }),
  dismiss: () => set({ dismissed: true }),
}));

// applyUpdate: tells the waiting version to take over; the page reloads once it has (controllerchange fires once)
export function applyUpdate(): void {
  const worker = useUpdateStore.getState().waiting;
  if (!worker) return;
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
  worker.postMessage({ type: "SKIP_WAITING" });
}
