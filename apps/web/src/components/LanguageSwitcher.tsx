import { Languages } from "lucide-react";
import { Button } from "@isnabero/ui";
import { LANGUAGES, useT } from "@/i18n";
import { useLanguageStore } from "@/stores/language-store";

// LanguageSwitcher: cycles through the supported languages; the button shows the current language code.
export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, language } = useT();
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const index = LANGUAGES.findIndex((item) => item.code === language);
  const next = LANGUAGES[(index + 1) % LANGUAGES.length]!;
  const current = LANGUAGES[index]!;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLanguage(next.code)}
      aria-label={`${t("language.switchTo", { language: current.label })} → ${next.label}`}
      title={`${t("language.label")}: ${current.label} → ${next.label}`}
      className={className ?? "gap-1 px-2 text-muted-foreground hover:bg-accent hover:text-foreground"}
    >
      <Languages className="h-4 w-4" />
      <span className="text-xs font-semibold uppercase">{current.code}</span>
    </Button>
  );
}
