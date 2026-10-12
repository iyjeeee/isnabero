import React from "react";
import ReactDOM from "react-dom/client";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster, toast } from "sonner";
import App from "./App";
import { translateNow } from "./i18n";
import "./index.css";

// Global mutation error handler: every failed save/delete/checkout surfaces a toast instead of failing silently
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    // PostgREST errors are plain objects (not Error instances), so read .message structurally
    onError: (error) => toast.error((error as { message?: string } | null)?.message || translateNow("errors.generic")),
  }),
});

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
