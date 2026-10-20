import type { Offering } from "@isnabero/module-catalog";

// findByBarcode: the available offering whose barcode equals the scanned text (ignoring case and surrounding spaces)
export function findByBarcode<T extends Pick<Offering, "barcode" | "isAvailable">>(offerings: T[], scanned: string): T | undefined {
  const code = scanned.trim().toLowerCase();
  if (!code) return undefined;
  return offerings.find((offering) => offering.isAvailable && offering.barcode?.toLowerCase() === code);
}

// SCAN_GAP_MS: keys arriving closer together than this are a scanner, not a person typing
export const SCAN_GAP_MS = 80;
export const MIN_SCAN_LENGTH = 4;

// ScanBuffer: collects fast key presses and hands back the code when Enter ends them. A pause longer than the gap starts over,
// so slow typing never counts as a scan. `now` is passed in so the timing can be tested.
export function createScanBuffer() {
  let text = "";
  let last = 0;
  return {
    push(key: string, now: number): string | null {
      if (key === "Enter") {
        const code = text;
        text = "";
        return code.length >= MIN_SCAN_LENGTH ? code : null;
      }
      if (key.length !== 1) return null; // Shift, Tab, arrows…: ignore without breaking the run
      if (now - last > SCAN_GAP_MS) text = "";
      text += key;
      last = now;
      return null;
    },
    reset() {
      text = "";
    },
  };
}
