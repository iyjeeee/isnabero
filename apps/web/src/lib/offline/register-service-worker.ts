import { useUpdateStore } from "./update-store";

const CHECK_EVERY_MS = 30 * 60 * 1000; // look for a new version this often while the app stays open

// registerServiceWorker: production builds only (a worker in dev would serve stale modules).
// Also watches for a newer version: when one has downloaded, the update bar offers it (see UpdateBanner).
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // only an *update* is announced: with no controller this is the very first install, which needs no prompt
        const announce = (worker: ServiceWorker | null) => {
          if (worker && navigator.serviceWorker.controller) useUpdateStore.getState().setWaiting(worker);
        };
        announce(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          installing?.addEventListener("statechange", () => {
            if (installing.state === "installed") announce(registration.waiting ?? installing);
          });
        });
        const check = () => registration.update().catch(() => undefined); // fails quietly when offline
        window.setInterval(check, CHECK_EVERY_MS);
        document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void check());
      })
      .catch(() => undefined); // offline shell is a bonus; ignore failures
  });
}
