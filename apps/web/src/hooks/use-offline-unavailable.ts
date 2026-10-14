import { useCallback, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";

// useOfflineUnavailable: true while the open page is waiting on data that was never loaded (offline, nothing cached)
export function useOfflineUnavailable(): boolean {
  const client = useQueryClient();
  const cache = client.getQueryCache();
  const subscribe = useCallback((onChange: () => void) => cache.subscribe(onChange), [cache]);
  const getSnapshot = useCallback(
    () => cache.getAll().some((query) => query.getObserversCount() > 0 && !query.isDisabled() && query.state.fetchStatus === "paused" && query.state.data === undefined),
    [cache],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
