import type { PendingSale } from "./types";
import { errorMessage, isConnectionError } from "./classify";

export interface SyncDeps {
  getSales: () => PendingSale[];
  send: (sale: PendingSale) => Promise<unknown>; // records one sale on the server (idempotent on clientId)
  onSent: (sale: PendingSale) => void;
  onRefused: (sale: PendingSale, message: string) => void;
  onAttempt: (sale: PendingSale) => void;
}

export interface SyncResult {
  sent: number;
  refused: number;
  stoppedOffline: boolean; // true when the connection dropped part-way, so the rest is still waiting
}

let running = false;

// syncPendingSales: sends waiting sales oldest first, one at a time (receipt numbers and stock follow the order they happened).
// A refused sale (e.g. not enough stock now) is parked for a person to decide and the rest carry on; a connection problem stops
// the run so nothing is skipped. Safe to call from several places: only one run goes at a time.
export async function syncPendingSales(deps: SyncDeps): Promise<SyncResult> {
  const result: SyncResult = { sent: 0, refused: 0, stoppedOffline: false };
  if (running) return result;
  running = true;
  try {
    const waiting = deps
      .getSales()
      .filter((sale) => sale.status === "pending")
      .sort((a, b) => a.soldAt.localeCompare(b.soldAt));
    for (const sale of waiting) {
      deps.onAttempt(sale);
      try {
        await deps.send(sale);
        deps.onSent(sale);
        result.sent += 1;
      } catch (error) {
        if (isConnectionError(error)) {
          result.stoppedOffline = true;
          break;
        }
        deps.onRefused(sale, errorMessage(error));
        result.refused += 1;
      }
    }
  } finally {
    running = false;
  }
  return result;
}
