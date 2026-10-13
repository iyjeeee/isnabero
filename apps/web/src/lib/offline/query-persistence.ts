import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";
import { parseWithDates, stringifyWithDates } from "./serialize";

// Offline read cache: successful query results are saved to localStorage so a reload while offline still shows the last data.
// It is wiped on sign-out / user change (see OfflineCacheGuard) and ignored once older than MAX_AGE_MS.
export const CACHE_KEY = "isnabero-offline-cache";
export const CACHE_USER_KEY = "isnabero-offline-cache-user";
export const CACHE_VERSION = 1;
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SAVE_DELAY_MS = 1000;

interface Snapshot {
  version: number;
  savedAt: number;
  state: ReturnType<typeof dehydrate>;
}

const safe = <T>(action: () => T, fallback: T): T => {
  try {
    return action();
  } catch {
    return fallback;
  }
};

// restoreQueryCache: loads a saved snapshot into the client; returns whether anything was restored
export function restoreQueryCache(client: QueryClient, storage: Storage = localStorage, now = Date.now()): boolean {
  return safe(() => {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return false;
    const snapshot = parseWithDates<Snapshot>(raw);
    if (snapshot.version !== CACHE_VERSION || now - snapshot.savedAt > MAX_AGE_MS) {
      storage.removeItem(CACHE_KEY);
      return false;
    }
    hydrate(client, snapshot.state);
    return true;
  }, false);
}

export function saveQueryCache(client: QueryClient, storage: Storage = localStorage, now = Date.now()): void {
  safe(() => {
    // keep any query that has data: a failed background refetch leaves its old data in place
    const state = dehydrate(client, { shouldDehydrateQuery: (query) => query.state.data !== undefined });
    storage.setItem(CACHE_KEY, stringifyWithDates({ version: CACHE_VERSION, savedAt: now, state } satisfies Snapshot));
  }, undefined);
}

// clearOfflineCache: removes the saved data (and the in-memory copy when a client is given)
export function clearOfflineCache(client?: QueryClient, storage: Storage = localStorage): void {
  safe(() => {
    storage.removeItem(CACHE_KEY);
    storage.removeItem(CACHE_USER_KEY);
  }, undefined);
  client?.clear();
}

// startQueryPersistence: saves (debounced) whenever the query cache changes; returns a stop function
export function startQueryPersistence(client: QueryClient, storage: Storage = localStorage): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = client.getQueryCache().subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => saveQueryCache(client, storage), SAVE_DELAY_MS);
  });
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}

// claimCacheForUser: keeps the saved cache only if it belongs to this user; otherwise wipes it and re-labels it
export function claimCacheForUser(client: QueryClient, userId: string, storage: Storage = localStorage): void {
  const owner = safe(() => storage.getItem(CACHE_USER_KEY), null);
  if (owner === userId) return;
  const hasUnlabelledCache = owner === null && safe(() => storage.getItem(CACHE_KEY) !== null, false);
  if (owner !== null || hasUnlabelledCache) clearOfflineCache(client, storage);
  safe(() => storage.setItem(CACHE_USER_KEY, userId), undefined);
}
