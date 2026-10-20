import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { Button, Card, CardContent, Input, Label } from "@isnabero/ui";
import { supabase } from "@/lib/supabase";
import { getDataSource } from "@isnabero/db";
import { useT } from "@/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

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
    <div className="relative flex min-h-screen items-center justify-center bg-background p-6">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher className="gap-1 px-2 text-muted-foreground hover:bg-accent hover:text-foreground" />
      </div>
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-card">
              <KeyRound className="h-5 w-5" />
            </div>
            <h1 className="font-display text-xl font-semibold">{t("setPassword.title")}</h1>
            {state === "ready" && <p className="text-sm text-muted-foreground">{t("setPassword.description")}</p>}
          </div>

          {state === "checking" && <p className="text-center text-sm text-muted-foreground">{t("common.loading")}</p>}

          {state === "expired" && (
            <div className="space-y-3 text-center text-sm">
              <p>{t("setPassword.expired")}</p>
              <Link to="/login" className="font-medium text-primary hover:underline">
                {t("setPassword.toLogin")}
              </Link>
            </div>
          )}

          {state === "ready" && (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">{t("setPassword.password")}</Label>
                <Input id="new-password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD} value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">{t("setPassword.confirm")}</Label>
                <Input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? t("common.saving") : t("setPassword.save")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
