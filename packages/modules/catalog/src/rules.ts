// OfferingInUseError: thrown by both repositories when deleting an offering that sales or bookings already point at.
// Those records keep their history, so the offering is kept too; the message is user-facing.
export const OFFERING_IN_USE_MESSAGE = "This offering has sales or bookings, so it can't be deleted. Mark it sold out instead.";

export class OfferingInUseError extends Error {
  constructor() {
    super(OFFERING_IN_USE_MESSAGE);
    this.name = "OfferingInUseError";
  }
}

export const BARCODE_MAX = 64;
export const DUPLICATE_BARCODE_MESSAGE = "Another item already uses this barcode.";

// normalizeBarcode: trims; blank means "no code" (null); throws a user-facing Error when too long
export function normalizeBarcode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim();
  if (!code) return null;
  if (code.length > BARCODE_MAX) throw new Error(`The barcode must be ${BARCODE_MAX} characters or fewer.`);
  return code;
}

// isSameBarcode: codes match ignoring upper/lower case, like the database's unique index
export const isSameBarcode = (a: string | null, b: string | null) => a !== null && b !== null && a.toLowerCase() === b.toLowerCase();
