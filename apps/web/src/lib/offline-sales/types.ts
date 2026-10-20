// PendingSale: a sale rung up without a connection (or whose reply was lost), kept on this device until it reaches the server.
// Only what the server needs is kept — ids, names and prices as the cashier saw them, and when it happened.
export interface PendingSaleLine {
  id: string; // offering id
  name: string;
  price: string; // price shown at the time (the server uses its own current price when the sale arrives)
  quantity: number;
}

export type PendingSaleMethod = "cash" | "gcash" | "bank_transfer" | "other";

export interface PendingSale {
  clientId: string; // made once per sale and kept across retries, so the server records it only once
  businessId: string;
  employeeId: string | null;
  lines: PendingSaleLine[];
  method: PendingSaleMethod;
  referenceCode?: string;
  soldAt: string; // ISO time of the sale
  total: number; // as shown at the time
  status: "pending" | "failed"; // failed = the server refused it (e.g. not enough stock); needs a person to decide
  error?: string;
  attempts: number;
}
