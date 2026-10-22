import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseCoreRepository } from "../supabase-repository";

// fakeClient: records the update chain and answers with the rows/error the test wants
function fakeClient(result: { data: unknown[] | null; error: unknown }) {
  const calls: string[] = [];
  const chain = {
    update: () => (calls.push("update"), chain),
    eq: () => chain,
    select: () => (calls.push("select"), Promise.resolve(result)),
  };
  return { client: { from: () => chain } as unknown as SupabaseClient, calls };
}

describe("voidPaymentRecord (Supabase)", () => {
  it("resolves when a row was voided", async () => {
    const { client, calls } = fakeClient({ data: [{ id: "p1" }], error: null });
    await expect(createSupabaseCoreRepository(client).voidPaymentRecord("b1", "p1")).resolves.toBeUndefined();
    expect(calls).toEqual(["update", "select"]);
  });

  it("throws when RLS filtered the row out (0 rows updated)", async () => {
    const { client } = fakeClient({ data: [], error: null });
    await expect(createSupabaseCoreRepository(client).voidPaymentRecord("b1", "p1")).rejects.toThrow(/permission to void/);
  });

  it("rethrows a database error", async () => {
    const { client } = fakeClient({ data: null, error: new Error("boom") });
    await expect(createSupabaseCoreRepository(client).voidPaymentRecord("b1", "p1")).rejects.toThrow("boom");
  });
});
