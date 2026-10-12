export const payments = {
  title: "Payment Records",
  description: "Every transaction, regardless of which module created it.",
  exportHint: "Uses the method filter and search currently applied.",
  source: { pos: "POS", booking: "Booking" },
  stats: { totalTransactions: "Total Transactions", totalCollected: "Total Collected", averageTransaction: "Average Transaction" },
  filters: { bank: "Bank", showVoided: "Show voided", searchPlaceholder: "Search reference or source…" },
  empty: {
    title: "No transactions yet",
    description: "Sales from POS and paid bookings will show up here.",
    noMatchTitle: "No matches",
    noMatchDescription: "Try a different search term or method filter.",
  },
  table: { source: "Source", method: "Method", reference: "Reference", amount: "Amount" },
  viewReceipt: "View receipt",
  viewReceiptFor: "View receipt for {date}",
  void: {
    ariaLabel: "Void transaction {amount}",
    title: "Void this transaction?",
    description: "This marks the {amount} transaction as voided and excludes it from totals. It stays visible under \"Show voided\" for your records and does NOT reverse the related order or booking.",
    confirm: "Void transaction",
    success: "Transaction voided",
  },
};
