import { useMemo } from "react";
import { useT } from "./use-t";

// Dates arrive either as Date objects or as calendar-day strings (YYYY-MM-DD). A day string is read as a LOCAL day, never
// through UTC, so it can't slip to the neighbouring day.
const toDate = (value: Date | string): Date => (typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00`) : value);

// useFormat: date/time formatting in the app locale (en-PH)
export function useFormat() {
  const { locale } = useT();
  return useMemo(
    () => ({
      date: (value: Date | string) => toDate(value).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" }),
      monthDay: (value: Date | string) => toDate(value).toLocaleDateString(locale, { month: "short", day: "numeric" }),
      weekday: (value: Date | string) => toDate(value).toLocaleDateString(locale, { weekday: "short" }),
      dateTime: (value: Date) => value.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }),
      time: (value: Date) => value.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }),
    }),
    [locale],
  );
}
