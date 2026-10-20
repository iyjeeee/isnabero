import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getPosRepository, type CheckoutInput, type CheckoutResult } from "@isnabero/module-pos";
import { supabase } from "@/lib/supabase";
import { translateNow } from "@/i18n";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { isConnectionError } from "./classify";
import { pendingQuantities, useOfflineSalesStore } from "./queue-store";
import { syncPendingSales } from "./sync";
import type { PendingSale } from "./types";

const RETRY_EVERY_MS = 30_000; // while online with sales waiting, try again at this pace

// refreshAfterSale: the lists a recorded sale changes
function refreshAfterSale(queryClient: ReturnType<typeof useQueryClient>, businessId: string) {
  for (const key of ["payment_records", "pos_orders", "dashboard_stats", "stock"]) queryClient.invalidateQueries({ queryKey: [key, businessId] });
}

// sendPendingSale: records one queued sale; the clientId makes a repeat harmless
function sendPendingSale(sale: PendingSale) {
  return getPosRepository(supabase).checkout({
    businessId: sale.businessId,
    employeeId: sale.employeeId,
    lines: sale.lines.map((line) => ({ offering: { id: line.id, name: line.name, price: line.price }, quantity: line.quantity })),
    method: sale.method,
    referenceCode: sale.referenceCode,
    clientId: sale.clientId,
    soldAt: new Date(sale.soldAt),
  });
}

// useOfflineSalesSync: mounted once in the app layout — sends waiting sales when the connection is back, when the app opens, and on a timer
export function useOfflineSalesSync() {
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const waiting = useOfflineSalesStore((state) => state.sales.filter((sale) => sale.status === "pending").length); // a changed count re-runs the effect, so a retried sale goes at once

  const run = useCallback(async () => {
    const store = useOfflineSalesStore.getState();
    const businesses = new Set(store.sales.map((sale) => sale.businessId));
    const result = await syncPendingSales({
      getSales: () => useOfflineSalesStore.getState().sales,
      send: sendPendingSale,
      onSent: (sale) => useOfflineSalesStore.getState().remove(sale.clientId),
      onRefused: (sale, message) => useOfflineSalesStore.getState().markFailed(sale.clientId, message),
      onAttempt: (sale) => useOfflineSalesStore.getState().touch(sale.clientId),
    });
    if (result.sent > 0) {
      toast.success(translateNow("offlineSales.synced", { count: result.sent }));
      businesses.forEach((id) => refreshAfterSale(queryClient, id));
    }
    if (result.refused > 0) toast.error(translateNow("offlineSales.refused", { count: result.refused }));
  }, [queryClient]);

  useEffect(() => {
    if (!online || waiting === 0) return;
    void run();
    const timer = window.setInterval(() => void run(), RETRY_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [online, waiting, run]);

  return run;
}

export interface QueuedSaleInfo {
  queued: true;
  clientId: string;
}

// useCheckoutOrQueue: rings up a sale now when connected; otherwise (or when the connection fails mid-sale) keeps it on this device to send later
export function useCheckoutOrQueue() {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  const submit = useCallback(
    async (input: CheckoutInput, details: { total: number; lines: { id: string; name: string; price: string; quantity: number }[] }): Promise<CheckoutResult | QueuedSaleInfo> => {
      const clientId = crypto.randomUUID(); // same id for the first try and any retry of this sale
      const soldAt = new Date();
      const queue = (): QueuedSaleInfo => {
        useOfflineSalesStore.getState().enqueue({
          clientId,
          businessId: input.businessId,
          employeeId: input.employeeId,
          lines: details.lines,
          method: input.method,
          referenceCode: input.referenceCode,
          soldAt: soldAt.toISOString(),
          total: details.total,
        });
        return { queued: true, clientId };
      };
      if (!navigator.onLine) return queue();
      setIsPending(true);
      try {
        const result = await getPosRepository(supabase).checkout({ ...input, clientId, soldAt });
        refreshAfterSale(queryClient, input.businessId);
        return result;
      } catch (error) {
        if (isConnectionError(error)) return queue(); // the reply may have been lost; the clientId stops a double sale on retry
        queryClient.invalidateQueries({ queryKey: ["stock", input.businessId] });
        throw error;
      } finally {
        setIsPending(false);
      }
    },
    [queryClient],
  );

  return { submit, isPending };
}

// usePendingByOffering: units waiting to be sent for this business, to take off the stock shown at the till
export function usePendingByOffering(businessId: string) {
  const sales = useOfflineSalesStore((state) => state.sales);
  return pendingQuantities(sales, businessId);
}
