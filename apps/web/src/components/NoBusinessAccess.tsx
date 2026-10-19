import { Building2 } from "lucide-react";
import { Button, EmptyState } from "@isnabero/ui";
import { useT } from "@/i18n";
import { useAuth } from "@/providers/AuthProvider";

// NoBusinessAccess: shown when someone signs in with an account that has no employee row (Supabase mode) —
// the owner must add them to a business first
export function NoBusinessAccess() {
  const { t } = useT();
  const { user, signOut } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <EmptyState
        icon={Building2}
        title={t("auth.noBusiness.title")}
        description={t("auth.noBusiness.description", { email: user?.email ?? "" })}
        action={<Button variant="outline" onClick={() => void signOut()}>{t("auth.noBusiness.signOut")}</Button>}
      />
    </div>
  );
}
