import { describe, expect, it } from "vitest";
import { fetchAllRows, PAGE_SIZE } from "../paginate";

// fakePages: a table of `total` rows served in range() slices, like PostgREST
function fakeTable(total: number) {
  const calls: Array<[number, number]> = [];
  const fetchPage = async (from: number, to: number) => {
    calls.push([from, to]);
    const data = Array.from({ length: Math.max(0, Math.min(to + 1, total) - from) }, (_, i) => from + i);
    return { data, error: null };
  };
  return { fetchPage, calls };
}

describe("fetchAllRows", () => {
  it("returns everything past the 1000-row cap", async () => {
    const { fetchPage, calls } = fakeTable(PAGE_SIZE * 2 + 5);
    const rows = await fetchAllRows(fetchPage);
    expect(rows).toHaveLength(PAGE_SIZE * 2 + 5);
    expect(rows[PAGE_SIZE * 2 + 4]).toBe(PAGE_SIZE * 2 + 4);
    expect(calls).toHaveLength(3);
  });

  it("stops after one request when the table is small, and after an exact multiple's empty last page", async () => {
    expect((await fetchAllRows(fakeTable(3).fetchPage))).toHaveLength(3);
    const exact = fakeTable(PAGE_SIZE);
    expect(await fetchAllRows(exact.fetchPage)).toHaveLength(PAGE_SIZE);
    expect(exact.calls).toHaveLength(2);
  });

  it("throws the query error", async () => {
    await expect(fetchAllRows(async () => ({ data: null, error: new Error("boom") }))).rejects.toThrow("boom");
  });
});
