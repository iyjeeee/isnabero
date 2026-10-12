import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Store } from "lucide-react";
import { Button, Card, CardContent, Input, Label } from "@isnabero/ui";
import { supabase } from "@/lib/supabase";
import { getDataSource } from "@isnabero/db";
import { useT } from "@/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function LoginPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (getDataSource() !== "supabase") {
      // Shouldn't normally be reachable — mock mode never redirects here — but guard anyway.
      setError(t("auth.mockModeError"));
      return;
    }

    setIsSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }
    navigate("/app");
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
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold">Isnabero</h1>
              <p className="text-sm text-muted-foreground">{t("auth.tagline")}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input id="password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
