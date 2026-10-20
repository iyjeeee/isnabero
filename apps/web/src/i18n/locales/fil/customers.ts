import type { Dictionary } from "../../translate";

export const customers: Dictionary["customers"] = {
  title: "Mga Customer",
  description: "Lahat ng nag-book sa iyo, kasama ang kasaysayan ng booking nila. Galing ito sa mga booking mo, kaya walang dagdag na aayusin.",
  searchPlaceholder: "Maghanap ng pangalan o contact…",
  searchAria: "Maghanap ng customer",
  emptyTitle: "Wala pang customer",
  emptyDescription: "Lalabas dito ang customer pagkatapos ng una niyang booking.",
  noMatchesTitle: "Walang tugma",
  noMatchesDescription: "Subukan ang ibang pangalan o numero.",
  table: { name: "Customer", contact: "Contact", bookings: "Mga booking", spent: "Nagastos", last: "Huling bisita", next: "Susunod na booking" },
  none: "—",
  detail: {
    title: "Detalye ng customer",
    visits: "Natapos na bisita",
    cancelled: "Kinansela",
    spent: "Kabuuang nagastos (natapos)",
    firstSeen: "Unang booking",
    history: "Kasaysayan ng booking",
  },
  exportHint: "Lahat ng customer na nakikita, kasama ang kabuuan nila.",
};
