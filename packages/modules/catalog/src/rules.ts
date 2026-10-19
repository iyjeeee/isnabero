// OfferingInUseError: thrown by both repositories when deleting an offering that sales or bookings already point at.
// Those records keep their history, so the offering is kept too; the message is user-facing.
export const OFFERING_IN_USE_MESSAGE = "This offering has sales or bookings, so it can't be deleted. Mark it sold out instead.";

export class OfferingInUseError extends Error {
  constructor() {
    super(OFFERING_IN_USE_MESSAGE);
    this.name = "OfferingInUseError";
  }
}
