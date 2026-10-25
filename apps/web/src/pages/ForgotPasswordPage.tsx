import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";
import { Button, Input, Label } from "@isnabero/ui";
import { supabase } from "@/lib/supabase";
import { getDataSource } from "@isnabero/db";
import { AuthShell } from "@/components/auth/AuthShell";
import { useT } from "@/i18n";

// ForgotPasswordPage: asks Supabase to email a reset link. The link opens /set-password (same page the invite email uses),
// where the person picks a new password. The reply never says whether the email has an account.
export default function ForgotPasswordPage() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (getDataSource() !== "supabase") {
      setError(t("auth.mockModeError"));
      return;
    }

    setIsSending(true);
    const address = email.trim();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: `${window.location.origin}/set-password` });
    setIsSending(false);

    if (resetError) {
      setError(resetError.message); // e.g. too many requests: Supabase says how long to wait
      return;
    }
    setSentTo(address);
  };

  const backLink = (
    <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <ArrowLeft className="h-4 w-4" />
      {t("auth.forgot.back")}
    </Link>
  );

  if (sentTo) {
    return (
      <AuthShell>
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-success/10 text-success">
          <MailCheck className="h-5 w-5" />
        </div>
        <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight">{t("auth.forgot.sentTitle")}</h1>
        <p role="status" className="mt-2 text-sm text-muted-foreground">{t("auth.forgot.sentDescription", { email: sentTo })}</p>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          {backLink}
          <button type="button" onClick={() => setSentTo(null)} className="text-sm text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {t("auth.forgot.tryAgain")}
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t("auth.forgot.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.forgot.description")}</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="reset-email">{t("auth.email")}</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="reset-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 pl-9" />
          </div>
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={isSending}>
          {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSending ? t("auth.forgot.sending") : t("auth.forgot.submit")}
        </Button>
      </form>

      <div className="mt-8">{backLink}</div>
    </AuthShell>
  );
}
