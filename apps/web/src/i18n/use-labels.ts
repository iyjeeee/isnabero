import { useMemo } from "react";
import { useT, type TFunction } from "./use-t";
import type { TranslationKey } from "./translate";

// Label lookups for stored enum values; an unknown value falls back to the raw value so nothing renders blank.
function makeLabeler(t: TFunction, group: string) {
  return (value: string): string => {
    const key = `enums.${group}.${value}` as TranslationKey;
    const text = t(key);
    return text === key ? value : text;
  };
}

// useLabels: `const { role, method, auditAction } = useLabels(); role("owner")`
export function useLabels() {
  const { t } = useT();
  return useMemo(
    () => ({
      role: makeLabeler(t, "role"),
      method: makeLabeler(t, "method"),
      bookingStatus: makeLabeler(t, "bookingStatus"),
      bookingMode: makeLabeler(t, "bookingMode"),
      offeringType: makeLabeler(t, "offeringType"),
      orderStatus: makeLabeler(t, "orderStatus"),
      expenseCategory: makeLabeler(t, "expenseCategory"),
      stockKind: makeLabeler(t, "stockKind"),
      stockStatus: makeLabeler(t, "stockStatus"),
      auditEntity: makeLabeler(t, "auditEntity"),
      // audit action ids contain dots ("sale.completed"); dictionary keys use underscores
      auditAction: (action: string) => makeLabeler(t, "auditAction")(action.replace(/\./g, "_")),
    }),
    [t],
  );
}
