import { Button, type ButtonProps } from "./button";
import { useUiLabels } from "./ui-labels";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./dialog";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  isPending?: boolean;
  variant?: ButtonProps["variant"];
  onConfirm: () => void;
}

// ConfirmDialog: the one confirmation modal every "Delete"/destructive action in the app should use,
// instead of each feature building its own ad-hoc confirm UI. Controlled component — pair with a local
// `open` state next to the trigger button (see DeleteEmployeeButton for the pattern).
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  isPending,
  variant = "destructive",
  onConfirm,
}: ConfirmDialogProps) {
  const labels = useUiLabels();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {labels.cancel}
          </Button>
          <Button type="button" variant={variant} onClick={onConfirm} disabled={isPending}>
            {isPending ? labels.pleaseWait : (confirmLabel ?? labels.confirm)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
