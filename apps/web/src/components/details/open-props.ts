import type { HTMLAttributes, KeyboardEvent, MouseEvent } from "react";

// INTERACTIVE: clicks that land on these inside a row/card belong to that control, not to "open details"
const INTERACTIVE = "button, a, input, select, textarea, label, [role='button'], [role='menuitem'], [role='switch'], [role='checkbox']";

// OPEN_CLASS: pointer + visible keyboard focus for anything made openable with openProps
export const OPEN_CLASS = "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

// openProps: spread onto a <tr> or card to make the whole thing open a detail dialog (mouse, Enter or Space).
// Ignores clicks on inner buttons/links and anything rendered in a portal (dialogs opened from the row's own actions).
export function openProps(onOpen: () => void): Pick<HTMLAttributes<HTMLElement>, "onClick" | "onKeyDown" | "tabIndex"> & { "aria-haspopup": "dialog" } {
  return {
    tabIndex: 0,
    "aria-haspopup": "dialog",
    onClick: (event: MouseEvent<HTMLElement>) => {
      const target = event.target as Element;
      if (!event.currentTarget.contains(target)) return; // bubbled up from a portal (e.g. an edit dialog)
      if (target.closest(INTERACTIVE)) return;
      if (window.getSelection()?.toString()) return; // the person was selecting text to copy it
      onOpen();
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return; // keys typed into inner controls stay theirs
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen();
      }
    },
  };
}
