import type { Dictionary } from "../../translate";

export const payments: Dictionary["payments"] = {
  title: "Mga Tala ng Bayad",
  description: "Lahat ng transaksyon, anuman ang module na gumawa nito.",
  exportHint: "Gagamitin ang kasalukuyang method filter at hinahanap.",
  source: { pos: "POS", booking: "Booking" },
  stats: { totalTransactions: "Kabuuang Transaksyon", totalCollected: "Kabuuang Nakolekta", averageTransaction: "Karaniwang Transaksyon" },
  filters: { bank: "Bank transfer", showVoided: "Ipakita ang na-void", searchPlaceholder: "Hanapin ang reference o source…" },
  empty: {
    title: "Wala pang transaksyon",
    description: "Dito lalabas ang mga benta mula sa POS at bayad na booking.",
    noMatchTitle: "Walang tugma",
    noMatchDescription: "Subukan ang ibang hinahanap o method filter.",
  },
  table: { source: "Pinagmulan", method: "Paraan", reference: "Reference", amount: "Halaga" },
  viewReceipt: "Tingnan ang receipt",
  viewReceiptFor: "Tingnan ang receipt noong {date}",
  void: {
    ariaLabel: "I-void ang transaksyon na {amount}",
    title: "I-void ang transaksyong ito?",
    description: "Mamarkahang na-void ang transaksyong {amount} at hindi na ito isasama sa kabuuan. Makikita pa rin ito sa \"Ipakita ang na-void\" para sa iyong records at HINDI nito ibabalik ang kaugnay na order o booking.",
    confirm: "I-void ang transaksyon",
    success: "Na-void na ang transaksyon",
  },
};
