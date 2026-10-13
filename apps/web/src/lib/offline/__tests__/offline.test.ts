import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { CACHE_KEY, CACHE_USER_KEY, MAX_AGE_MS, claimCacheForUser, clearOfflineCache, restoreQueryCache, saveQueryCache } from "../query-persistence";
import { parseWithDates, stringifyWithDates } from "../serialize";

// Minimal in-memory Storage (the tests run without a DOM)
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

const filled = () => {
  const client = new QueryClient();
  client.setQueryData(["sales", "b1"], [{ id: 1, createdAt: new Date("2026-10-12T05:30:00Z"), voidedAt: null }]);
  client.setQueryData(["name", "b1"], "Sample Business");
  return client;
};

describe("serialize", () => {
  it("round-trips Dates, nulls and nesting", () => {
    const value = { a: new Date("2026-01-02T03:04:05Z"), b: [{ c: new Date("2026-05-06T00:00:00Z"), d: null }], e: "x", f: 3 };
    const back = parseWithDates<typeof value>(stringifyWithDates(value));
    expect(back.a).toBeInstanceOf(Date);
    expect(back.a.toISOString()).toBe("2026-01-02T03:04:05.000Z");
    expect(back.b[0]!.c.getTime()).toBe(new Date("2026-05-06T00:00:00Z").getTime());
    expect(back.b[0]!.d).toBeNull();
    expect(back.e).toBe("x");
  });

  it("keeps an invalid Date invalid instead of throwing", () => {
    const back = parseWithDates<{ d: Date }>(stringifyWithDates({ d: new Date("nope") }));
    expect(Number.isNaN(back.d.getTime())).toBe(true);
  });
});

describe("offline query cache", () => {
  it("saves and restores query data with real Dates", () => {
    const storage = memoryStorage();
    saveQueryCache(filled(), storage);
    const fresh = new QueryClient();
    expect(restoreQueryCache(fresh, storage)).toBe(true);
    const sales = fresh.getQueryData<Array<{ createdAt: Date }>>(["sales", "b1"])!;
    expect(sales[0]!.createdAt).toBeInstanceOf(Date);
    expect(fresh.getQueryData(["name", "b1"])).toBe("Sample Business");
  });

  it("keeps data of a query whose background refetch failed", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(["kept"], "old data");
    await client.fetchQuery({ queryKey: ["kept"], queryFn: () => Promise.reject(new Error("offline")), staleTime: 0 }).catch(() => undefined);
    expect(client.getQueryState(["kept"])?.status).toBe("error");
    const storage = memoryStorage();
    saveQueryCache(client, storage);
    const fresh = new QueryClient();
    restoreQueryCache(fresh, storage);
    expect(fresh.getQueryData(["kept"])).toBe("old data");
  });

  it("does not save pending queries", () => {
    const client = filled();
    void client.prefetchQuery({ queryKey: ["pending"], queryFn: () => new Promise(() => undefined) });
    const storage = memoryStorage();
    saveQueryCache(client, storage);
    const fresh = new QueryClient();
    restoreQueryCache(fresh, storage);
    expect(fresh.getQueryData(["pending"])).toBeUndefined();
  });

  it("ignores and removes a cache older than the max age or from another version", () => {
    const storage = memoryStorage();
    saveQueryCache(filled(), storage, 1000);
    expect(restoreQueryCache(new QueryClient(), storage, 1000 + MAX_AGE_MS + 1)).toBe(false);
    expect(storage.getItem(CACHE_KEY)).toBeNull();
    storage.setItem(CACHE_KEY, JSON.stringify({ version: 999, savedAt: Date.now(), state: { queries: [], mutations: [] } }));
    expect(restoreQueryCache(new QueryClient(), storage)).toBe(false);
  });

  it("survives corrupt or unavailable storage", () => {
    const storage = memoryStorage();
    storage.setItem(CACHE_KEY, "{not json");
    expect(restoreQueryCache(new QueryClient(), storage)).toBe(false);
    const broken = { ...memoryStorage(), getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } } as Storage;
    expect(() => saveQueryCache(filled(), broken)).not.toThrow();
    expect(restoreQueryCache(new QueryClient(), broken)).toBe(false);
  });

  it("keeps the cache for the same user and wipes it for another or for sign-out", () => {
    const storage = memoryStorage();
    const client = filled();
    claimCacheForUser(client, "u1", storage); // first login labels the (still empty) cache
    saveQueryCache(client, storage);
    claimCacheForUser(client, "u1", storage); // later start-ups by the same user keep it
    expect(storage.getItem(CACHE_KEY)).not.toBeNull();
    expect(storage.getItem(CACHE_USER_KEY)).toBe("u1");
    claimCacheForUser(client, "u1", storage);
    expect(client.getQueryData(["name", "b1"])).toBe("Sample Business");
    claimCacheForUser(client, "u2", storage);
    expect(storage.getItem(CACHE_KEY)).toBeNull();
    expect(storage.getItem(CACHE_USER_KEY)).toBe("u2");
    expect(client.getQueryData(["name", "b1"])).toBeUndefined();
    saveQueryCache(filled(), storage);
    clearOfflineCache(client, storage);
    expect(storage.getItem(CACHE_KEY)).toBeNull();
    expect(storage.getItem(CACHE_USER_KEY)).toBeNull();
  });

  it("wipes an unlabelled leftover cache on first claim, but not an empty first login", () => {
    const storage = memoryStorage();
    const client = filled();
    saveQueryCache(client, storage);
    claimCacheForUser(client, "u1", storage);
    expect(storage.getItem(CACHE_KEY)).toBeNull();
    const fresh = filled();
    claimCacheForUser(fresh, "u9", memoryStorage());
    expect(fresh.getQueryData(["name", "b1"])).toBe("Sample Business");
  });
});
