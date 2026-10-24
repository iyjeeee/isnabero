import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button, Input, Label } from "@isnabero/ui";
import { AuthShell } from "@/components/auth/AuthShell";
import { supabase } from "@/lib/supabase";
import { getDataSource } from "@isnabero/db";
import { useT } from "@/i18n";

const MIN_PASSWORD = 8;

// SetPasswordPage: where the invite email sends a new employee. The link signs them in (supabase-js reads it from the address);
// here they choose the password they will use from now on.
export default function SetPasswordPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ready" | "expired">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (getDataSource() !== "supabase") {
      setState("expired");
      return;
    }
    let active = true;
    // the session may take a moment to be read from the link, so wait for it before saying the link is bad
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) setState("ready");
    });
    const timer = window.setTimeout(() => {
      supabase.auth.getSession().then(({ data }) => active && setState(data.session ? "ready" : "expired"));
    }, 1500);
    return () => {
      active = false;
      window.clearTimeout(timer);
      subscription.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(t("setPassword.tooShort", { min: MIN_PASSWORD }));
    if (password !== confirm) return setError(t("setPassword.mismatch"));
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) return setError(updateError.message);
    navigate("/app", { replace: true });
  };

  return (
    <AuthShell>
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t("setPassword.title")}</h1>
        {state === "ready" && <p className="text-sm text-muted-foreground">{t("setPassword.description")}</p>}
      </div>

      {state === "checking" && <p className="mt-8 text-sm text-muted-foreground">{t("common.loading")}</p>}

      {state === "expired" && (
        <div className="mt-8 space-y-3 text-sm">
          <p>{t("setPassword.expired")}</p>
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t("setPassword.toLogin")}
          </Link>
        </div>
      )}

      {state === "ready" && (
        <form onSubmit={submit} className="mt-8 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">{t("setPassword.password")}</Label>
            <Input id="new-password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD} value={password} onChange={(event) => setPassword(event.target.value)} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">{t("setPassword.confirm")}</Label>
            <Input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} className="h-11" />
          </div>
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? t("common.saving") : t("setPassword.save")}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
