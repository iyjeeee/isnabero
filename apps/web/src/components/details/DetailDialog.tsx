import type { ReactNode } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@isnabero/ui";
import { useT } from "@/i18n";

export interface DetailField {
  label: string;
  value: ReactNode; // null / undefined / "" shows as an em dash
  wide?: boolean; // spans both columns (long text such as notes)
}

interface DetailDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  badges?: ReactNode; // status chips shown under the title
  fields: DetailField[];
  children?: ReactNode; // extra sections below the fields (line items, history…)
  actions?: ReactNode; // extra footer buttons, left of Close
}

// DetailDialog: read-only "all the details" view shared by every table/card in the app
export function DetailDialog({ open, onClose, title, description, badges, fields, children, actions }: DetailDialogProps) {
  const { t } = useT();
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? undefined : "sr-only"}>{description ?? title}</DialogDescription>
          {badges && <div className="flex flex-wrap items-center gap-2 pt-1">{badges}</div>}
        </DialogHeader>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label} className={field.wide ? "sm:col-span-2" : undefined}>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.label}</dt>
              <dd className="mt-1 break-words text-sm">{field.value === null || field.value === undefined || field.value === "" ? "—" : field.value}</dd>
            </div>
          ))}
        </dl>
        {children}
        <DialogFooter>
          {actions}
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
