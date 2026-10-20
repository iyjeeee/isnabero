import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { getDataSource } from "@isnabero/db";
import { useAuth } from "@/providers/AuthProvider";
import { useT } from "@/i18n";

// SignOutButton: signs out of Supabase; in demo mode there is no login, so it explains that instead
export function SignOutButton({ className }: { className?: string }) {
  const { signOut } = useAuth();
  const { t } = useT();

  const handleSignOut = async () => {
    if (getDataSource() !== "supabase") {
      toast.info(t("nav.signOutMock"));
      return;
    }
    await signOut();
  };

  return (
    <button type="button" onClick={handleSignOut} title={t("nav.signOut")} aria-label={t("nav.signOut")} className={className}>
      <LogOut className="h-4 w-4" />
    </button>
  );
}
