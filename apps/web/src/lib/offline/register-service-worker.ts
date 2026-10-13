// registerServiceWorker: production builds only (a worker in dev would serve stale modules)
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined); // offline shell is a bonus; ignore failures
  });
}
