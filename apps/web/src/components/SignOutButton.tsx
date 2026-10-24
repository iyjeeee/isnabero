import { useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@isnabero/ui";
import { getDataSource } from "@isnabero/db";
import { useAuth } from "@/providers/AuthProvider";
import { useOfflineSalesStore } from "@/lib/offline-sales/queue-store";
import { useT } from "@/i18n";

// SignOutButton: asks first, then signs out of Supabase; in demo mode there is no login, so it explains that instead
export function SignOutButton({ className }: { className?: string }) {
  const { signOut } = useAuth();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const waitingSales = useOfflineSalesStore((state) => state.sales.length); // sales saved on this device and not yet sent

  const handleClick = () => {
    if (getDataSource() !== "supabase") {
      toast.info(t("nav.signOutMock"));
      return;
    }
    setOpen(true);
  };

  const handleConfirm = async () => {
    setPending(true);
    try {
      await signOut();
    } finally {
      setPending(false);
      setOpen(false);
    }
  };

  const description = waitingSales > 0
    ? `${t("nav.signOutConfirm.description")} ${t("nav.signOutConfirm.pending", { count: waitingSales })} ${t("nav.signOutConfirm.pendingHint")}`
    : t("nav.signOutConfirm.description");

  return (
    <>
      <button type="button" onClick={handleClick} title={t("nav.signOut")} aria-label={t("nav.signOut")} className={className}>
        <LogOut className="h-4 w-4" />
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => !pending && setOpen(next)}
        title={t("nav.signOutConfirm.title")}
        description={description}
        confirmLabel={t("nav.signOut")}
        variant="default"
        isPending={pending}
        onConfirm={() => void handleConfirm()}
      />
    </>
  );
}
