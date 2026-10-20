import { useEffect, useRef } from "react";
import { createScanBuffer } from "@/lib/barcode-scan";

interface PosShortcuts {
  onScan: (code: string) => void; // a barcode scanned while no field is focused
  onFocusSearch: () => void; // "/"
  onCheckout: () => void; // F9
}

// isTyping: focus is in a field where keys belong to the person, not to a scanner or a shortcut
const isTyping = (element: Element | null) => element instanceof HTMLElement && (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName));

// usePosShortcuts: till keyboard shortcuts and USB/Bluetooth barcode scanners (they type the code fast and press Enter).
// Does nothing while a dialog is open.
export function usePosShortcuts(handlers: PosShortcuts) {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    const buffer = createScanBuffer();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (event.key === "F9") {
        event.preventDefault();
        latest.current.onCheckout();
        return;
      }
      if (isTyping(document.activeElement)) return;
      if (event.key === "/") {
        event.preventDefault();
        latest.current.onFocusSearch();
        return;
      }
      const code = buffer.push(event.key, event.timeStamp);
      if (code) {
        event.preventDefault(); // the Enter that ended the scan must not click a focused button
        latest.current.onScan(code);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
