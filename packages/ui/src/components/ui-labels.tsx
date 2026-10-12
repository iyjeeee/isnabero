import { createContext, useContext, type ReactNode } from "react";

// UiLabels: the few strings baked into shared components. English defaults; the app supplies translations via the provider.
export interface UiLabels {
  close: string;
  cancel: string;
  confirm: string;
  pleaseWait: string;
  prev: string;
  next: string;
  quantity: string;
  trendLabel: string;
  trendNoData: (label: string) => string;
  decreaseQuantity: string;
  increaseQuantity: string;
  showingRange: (start: number, end: number, total: number) => string;
  pageOf: (page: number, total: number) => string;
}

export const DEFAULT_UI_LABELS: UiLabels = {
  close: "Close",
  cancel: "Cancel",
  confirm: "Confirm",
  pleaseWait: "Please wait…",
  prev: "Prev",
  next: "Next",
  quantity: "Quantity",
  trendLabel: "vs previous period",
  trendNoData: (label) => `No data for ${label}`,
  decreaseQuantity: "Decrease quantity",
  increaseQuantity: "Increase quantity",
  showingRange: (start, end, total) => `Showing ${start}-${end} of ${total}`,
  pageOf: (page, total) => `Page ${page} of ${total}`,
};

const UiLabelsContext = createContext<UiLabels>(DEFAULT_UI_LABELS);

export function UiLabelsProvider({ labels, children }: { labels: UiLabels; children: ReactNode }) {
  return <UiLabelsContext.Provider value={labels}>{children}</UiLabelsContext.Provider>;
}

export const useUiLabels = () => useContext(UiLabelsContext);
