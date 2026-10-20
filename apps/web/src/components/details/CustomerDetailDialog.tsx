import { Badge } from "@isnabero/ui";
import { useFormat, useLabels, useT } from "@/i18n";
import { formatPeso } from "@/lib/money";
import type { Customer } from "@/lib/customers";
import { DetailDialog } from "./DetailDialog";

const STATUS_VARIANT = { pending: "warning", confirmed: "info", completed: "success", cancelled: "destructive" } as const;

export function CustomerDetailDialog({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const { t } = useT();
  const format = useFormat();
  const labels = useLabels();
  if (!customer) return null;
  const oldest = customer.bookings[customer.bookings.length - 1];
  return (
    <DetailDialog
      open
      onClose={onClose}
      title={customer.name}
      description={t("customers.detail.title")}
      fields={[
        { label: t("customers.table.contact"), value: customer.contact },
        { label: t("customers.detail.firstSeen"), value: oldest ? format.date(new Date(oldest.startTime)) : null },
        { label: t("customers.detail.visits"), value: customer.visits },
        { label: t("customers.detail.cancelled"), value: customer.cancelled },
        { label: t("customers.detail.spent"), value: <span className="font-display text-lg font-bold">{formatPeso(customer.spent)}</span> },
        { label: t("customers.table.next"), value: customer.next ? format.dateTime(customer.next) : null },
      ]}
    >
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("customers.detail.history")}</p>
        <ul className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
          {customer.bookings.map((booking) => (
            <li key={booking.id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{booking.offering.name}</p>
                <p className="text-xs text-muted-foreground">{format.dateTime(new Date(booking.startTime))}</p>
              </div>
              <span className="shrink-0 text-muted-foreground">{formatPeso(booking.offering.price)}</span>
              <Badge variant={STATUS_VARIANT[booking.status]}>{labels.bookingStatus(booking.status)}</Badge>
            </li>
          ))}
        </ul>
      </div>
    </DetailDialog>
  );
}
