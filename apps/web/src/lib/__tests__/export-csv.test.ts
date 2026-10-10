import { describe, expect, it } from "vitest";
import { buildCsv } from "../export-csv";

describe("buildCsv", () => {
  it("writes headers from the first row and one line per row", () => {
    expect(buildCsv([{ A: "x", B: 1 }, { A: "y", B: 2 }])).toBe("A,B\nx,1\ny,2");
  });

  it("quotes cells containing commas, quotes, or newlines", () => {
    expect(buildCsv([{ A: 'say "hi", ok' }])).toBe('A\n"say ""hi"", ok"');
  });

  it("prefixes formula-looking text so spreadsheets don't execute it, but leaves numbers alone", () => {
    const csv = buildCsv([{ Ref: "=HYPERLINK(\"http://x\")", Other: "+1", Neg: -5, Plain: "GC123" }]);
    const [, row] = csv.split("\n");
    expect(row).toContain("\"'=HYPERLINK(");
    expect(row).toContain(",'+1,");
    expect(row).toContain(",-5,");
    expect(row).toContain(",GC123");
  });

  it("returns an empty string for no rows", () => {
    expect(buildCsv([])).toBe("");
  });
});
