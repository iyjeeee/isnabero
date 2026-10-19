import type { BookingWithOffering } from "@isnabero/module-booking";
import { Badge } from "@isnabero/ui";
import { useFormat, useLabels, useT } from "@/i18n";
import { formatPeso } from "@/lib/money";
import { DetailDialog } from "./DetailDialog";

const STATUS_VARIANT = { pending: "warning", confirmed: "info", completed: "success", cancelled: "destructive" } as const;

export function BookingDetailDialog({ booking, onClose }: { booking: BookingWithOffering | null; onClose: () => void }) {
  const { t } = useT();
  const format = useFormat();
  const labels = useLabels();
  if (!booking) return null;
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  return (
    <DetailDialog
      open
      onClose={onClose}
      title={booking.customerName}
      description={t("details.titles.booking")}
      badges={<Badge variant={STATUS_VARIANT[booking.status]}>{labels.bookingStatus(booking.status)}</Badge>}
      fields={[
        { label: t("details.fields.package"), value: booking.offering.name },
        { label: t("details.fields.price"), value: formatPeso(booking.offering.price) },
        { label: t("details.fields.starts"), value: format.dateTime(start) },
        { label: t("details.fields.ends"), value: format.time(end) },
        { label: t("details.fields.duration"), value: t("details.minutes", { count: Math.round((end.getTime() - start.getTime()) / 60000) }) },
        { label: t("details.fields.mode"), value: labels.bookingMode(booking.mode) },
        { label: t("details.fields.contact"), value: booking.customerContact, wide: true },
        { label: t("details.fields.inclusions"), value: booking.offering.inclusions.length ? booking.offering.inclusions.map((inclusion) => `${inclusion.label}${inclusion.quantity ? ` × ${inclusion.quantity}` : ""}`).join(", ") : null, wide: true },
        { label: t("details.fields.recordedOn"), value: format.dateTime(new Date(booking.createdAt)) },
      ]}
    />
  );
}
