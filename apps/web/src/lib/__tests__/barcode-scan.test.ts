import { describe, expect, it } from "vitest";
import { createScanBuffer, findByBarcode } from "../barcode-scan";

describe("findByBarcode", () => {
  const items = [
    { barcode: "ABC-1", isAvailable: true },
    { barcode: "SOLD", isAvailable: false },
    { barcode: null, isAvailable: true },
  ];
  it("matches ignoring case and spaces", () => expect(findByBarcode(items, "  abc-1 ")).toBe(items[0]));
  it("skips sold-out items, unknown codes and blanks", () => {
    expect(findByBarcode(items, "SOLD")).toBeUndefined();
    expect(findByBarcode(items, "nope")).toBeUndefined();
    expect(findByBarcode(items, "")).toBeUndefined();
  });
});

describe("createScanBuffer", () => {
  const type = (buffer: ReturnType<typeof createScanBuffer>, text: string, start: number, gap: number) => {
    text.split("").forEach((key, index) => buffer.push(key, start + index * gap));
    return start + text.length * gap;
  };
  it("returns a code typed at scanner speed once Enter arrives", () => {
    const buffer = createScanBuffer();
    const end = type(buffer, "4800001000011", 1000, 10);
    expect(buffer.push("Enter", end)).toBe("4800001000011");
  });
  it("ignores slow human typing", () => {
    const buffer = createScanBuffer();
    const end = type(buffer, "hello world", 1000, 200);
    expect(buffer.push("Enter", end)).toBeNull();
  });
  it("ignores very short runs and non-character keys", () => {
    const buffer = createScanBuffer();
    buffer.push("a", 1000);
    buffer.push("Shift", 1005);
    buffer.push("b", 1010);
    expect(buffer.push("Enter", 1015)).toBeNull();
  });
});
