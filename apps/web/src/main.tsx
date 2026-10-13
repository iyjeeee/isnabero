import React from "react";
import ReactDOM from "react-dom/client";
import { MutationCache, QueryClient, onlineManager, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster, toast } from "sonner";
import App from "./App";
import { getDataSource } from "@isnabero/db";
import { translateNow } from "./i18n";
import { restoreQueryCache, startQueryPersistence, MAX_AGE_MS } from "./lib/offline/query-persistence";
import { registerServiceWorker } from "./lib/offline/register-service-worker";
import "./index.css";

// Global mutation error handler: every failed save/delete/checkout surfaces a toast instead of failing silently
const queryClient = new QueryClient({
  // gcTime >= the offline cache's max age, so pages opened earlier are still there to save and restore
  defaultOptions: { queries: { gcTime: MAX_AGE_MS }, mutations: { networkMode: "always" } },
  mutationCache: new MutationCache({
    // Offline = read-only: refuse every change up front (stock and receipt numbers are assigned by the server)
    onMutate: () => {
      if (!navigator.onLine) throw new Error(translateNow("offline.cannotSave"));
    },
    // PostgREST errors are plain objects (not Error instances), so read .message structurally
    onError: (error) => toast.error((error as { message?: string } | null)?.message || translateNow("errors.generic")),
  }),
});

// React Query assumes "online" until it sees an event, so a page loaded while offline must say so up front
onlineManager.setOnline(navigator.onLine);

// Offline read cache: on for real data (Supabase) — or in mock mode when VITE_OFFLINE_CACHE=true, for testing
if (getDataSource() === "supabase" || import.meta.env.VITE_OFFLINE_CACHE === "true") {
  restoreQueryCache(queryClient);
  startQueryPersistence(queryClient);
}
registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
        <Toaster position="top-right" richColors closeButton />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
