import { Moon, Sun } from "lucide-react";
import { Button } from "@isnabero/ui";
import { useThemeStore } from "@/stores/theme-store";
import { useT } from "@/i18n";

export function ThemeToggle() {
  const { t } = useT();
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === "light" ? t("nav.switchToDark") : t("nav.switchToLight")}
      className="text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
    >
      {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}
