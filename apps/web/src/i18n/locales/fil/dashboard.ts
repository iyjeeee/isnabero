import type { Dictionary } from "../../translate";

export const dashboard: Dictionary["dashboard"] = {
  title: "Dashboard",
  description: "{greeting} — narito ang aktibidad ngayon sa lahat ng naka-enable na module.",
  greeting: { morning: "Magandang umaga", afternoon: "Magandang hapon", evening: "Magandang gabi" },
  stats: { todaySales: "Benta Ngayon", upcomingBookings: "Mga Paparating na Booking", activeEmployees: "Mga Aktibong Empleyado" },
  stockAlerts: { title: "Mga alerto sa stock", openInventory: "Buksan ang Imbentaryo" },
  quickActions: {
    title: "Mabilisang Aksyon",
    empty: "Mag-enable ng module para makita ang mabilisang aksyon dito.",
    pos: { label: "Mag-benta", description: "Buksan ang POS screen" },
    catalog: { label: "Idagdag sa Katalogo", description: "Bagong item, bundle o add-on" },
    booking: { label: "Bagong booking", description: "Mag-iskedyul ng customer" },
    expenses: { label: "Mag-record ng gastos", description: "Upa, supplies, utilities…" },
  },
  checklist: {
    title: "Pagsisimula",
    setup: "Tapusin ang business setup",
    catalog: "Magdagdag ng unang item sa katalogo",
    firstSale: "I-record ang una mong benta o booking",
    teammate: "Magdagdag ng kasamahan sa team",
    allDone: "Tapos na ang setup — handa ka na!",
  },
  activity: {
    title: "Kamakailang Aktibidad",
    emptyTitle: "Wala pang aktibidad",
    emptyDescription: "Dito lalabas ang mga benta at bayad na booking.",
  },
};
