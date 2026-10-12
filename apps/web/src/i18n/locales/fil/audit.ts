import type { Dictionary } from "../../translate";

export const audit: Dictionary["audit"] = {
  title: "Audit Log",
  description: "Sino ang gumawa ng ano, at kailan. Hindi puwedeng i-edit o burahin ang mga entry.",
  exportHint: "Ginagamit ang filter at hanap na kasalukuyang nakalagay.",
  searchPlaceholder: "Maghanap ng tao o detalye…",
  searchAria: "Maghanap sa audit log",
  tabs: {
    sale: "Benta",
    payment: "Bayad",
    booking: "Booking",
    offering: "Katalogo",
    stock: "Stock",
    shift: "Shift",
    expense: "Gastos",
    employee: "Empleyado",
    business: "Negosyo",
  },
  empty: {
    noneTitle: "Wala pang naitala",
    noneDescription: "Lalabas dito ang mga benta, void, booking, gastos, at pagbabago sa staff habang nangyayari ang mga ito.",
    noMatchesTitle: "Walang tugma",
    noMatchesDescription: "Subukan ang ibang hanap o filter.",
  },
  table: {
    when: "Kailan",
    who: "Sino",
    action: "Aksyon",
    details: "Detalye",
  },
};
