import { beforeEach, describe, expect, it, vi } from "vitest";
import { isConnectionError } from "../classify";
import { pendingQuantities, useOfflineSalesStore } from "../queue-store";
import { syncPendingSales, type SyncDeps } from "../sync";
import type { PendingSale } from "../types";

const sale = (id: string, soldAt: string, extra: Partial<PendingSale> = {}): PendingSale => ({
  clientId: id,
  businessId: "b1",
  employeeId: null,
  lines: [{ id: "o1", name: "Item", price: "10.00", quantity: 2 }],
  method: "cash",
  soldAt,
  total: 20,
  status: "pending",
  attempts: 0,
  ...extra,
});

describe("isConnectionError", () => {
  it("treats network failures and expired logins as retryable", () => {
    expect(isConnectionError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isConnectionError({ message: "JWT expired", code: "PGRST301" })).toBe(true);
    expect(isConnectionError({ message: "Load failed" })).toBe(true);
  });
  it("treats a refusal from the server as final", () => {
    expect(isConnectionError({ message: "Not enough stock", code: "23514" })).toBe(false);
    expect(isConnectionError({ message: "not allowed", code: "42501" })).toBe(false);
    expect(isConnectionError(new Error("boom"))).toBe(false);
  });
});

describe("queue store", () => {
  beforeEach(() => useOfflineSalesStore.setState({ sales: [] }));

  it("ignores a sale queued twice and removes by id", () => {
    const { enqueue, remove } = useOfflineSalesStore.getState();
    const input = sale("a", "2026-01-01T10:00:00Z");
    enqueue(input);
    enqueue(input);
    expect(useOfflineSalesStore.getState().sales).toHaveLength(1);
    remove("a");
    expect(useOfflineSalesStore.getState().sales).toHaveLength(0);
  });

  it("counts waiting units per offering, skipping refused sales and other businesses", () => {
    const totals = pendingQuantities([sale("a", "t"), sale("b", "t"), sale("c", "t", { status: "failed" }), sale("d", "t", { businessId: "b2" })], "b1");
    expect(totals.get("o1")).toBe(4);
  });
});

describe("syncPendingSales", () => {
  const make = (sales: PendingSale[], send: SyncDeps["send"]) => {
    const sent: string[] = [];
    const refused: string[] = [];
    const deps: SyncDeps = { getSales: () => sales, send, onSent: (s) => sent.push(s.clientId), onRefused: (s) => refused.push(s.clientId), onAttempt: vi.fn() };
    return { deps, sent, refused };
  };

  it("sends oldest first", async () => {
    const order: string[] = [];
    const { deps, sent } = make([sale("late", "2026-01-01T12:00:00Z"), sale("early", "2026-01-01T09:00:00Z")], async (s) => void order.push(s.clientId));
    const result = await syncPendingSales(deps);
    expect(order).toEqual(["early", "late"]);
    expect(sent).toEqual(["early", "late"]);
    expect(result).toEqual({ sent: 2, refused: 0, stoppedOffline: false });
  });

  it("parks a refused sale and carries on", async () => {
    const { deps, sent, refused } = make([sale("a", "1"), sale("b", "2")], async (s) => {
      if (s.clientId === "a") throw { message: "Not enough stock", code: "23514" };
    });
    const result = await syncPendingSales(deps);
    expect(refused).toEqual(["a"]);
    expect(sent).toEqual(["b"]);
    expect(result.refused).toBe(1);
  });

  it("stops at a connection problem so nothing is skipped", async () => {
    const { deps, sent } = make([sale("a", "1"), sale("b", "2")], async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await syncPendingSales(deps);
    expect(sent).toEqual([]);
    expect(result.stoppedOffline).toBe(true);
  });

  it("does not send failed sales and runs one pass at a time", async () => {
    let calls = 0;
    const { deps } = make([sale("a", "1", { status: "failed" }), sale("b", "2")], async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    const [first, second] = await Promise.all([syncPendingSales(deps), syncPendingSales(deps)]);
    expect(calls).toBe(1);
    expect(first.sent + second.sent).toBe(1);
  });
});
