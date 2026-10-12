import type { Dictionary } from "../../translate";

export const booking: Dictionary["booking"] = {
  title: "Booking",
  description: "Ngayong araw at sa susunod na 30 araw.",
  exportHint: "Sakop ang mga booking na nakalista sa page na ito (ngayong araw at susunod na 30 araw).",
  stats: { today: "Mga Booking Ngayon", confirmed: "Kumpirmado", next: "Susunod na Booking" },
  searchPlaceholder: "Maghanap ayon sa pangalan ng customer…",
  empty: { title: "Walang paparating na booking", description: "I-tap ang Bagong Booking para i-reserve ang unang slot." },
  noMatches: { title: "Walang tugma", description: "Subukan ang ibang hinahanap." },
  modal: {
    trigger: "Bagong Booking",
    title: "Bagong booking",
    description: "Mag-reserve ng slot sa isang bookable na package mula sa Katalogo.",
    package: "Package",
    packagePlaceholder: "Pumili ng package…",
    customerName: "Pangalan ng customer",
    startTime: "Oras ng simula",
    confirm: "Kumpirmahin ang Booking",
    booking: "Nagbo-book…",
    fillIn: "Ilagay muna ang package, pangalan ng customer, at oras ng simula",
    booked: "Na-book si {customer} para sa {offering}",
  },
};
