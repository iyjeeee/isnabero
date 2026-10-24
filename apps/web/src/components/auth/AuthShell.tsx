import type { CSSProperties, ReactNode } from "react";
import { BookOpen, CalendarClock, History, Package, Receipt, ShieldCheck, ShoppingCart, Store, WifiOff, type LucideIcon } from "lucide-react";
import { useT } from "@/i18n";

// MODULE_TILES: the panel shows the product's real idea — modules you switch on or off; `on` tiles light up one after another on load
const MODULE_TILES: { key: "pos" | "booking" | "catalog" | "inventory" | "expenses" | "scheduling"; icon: LucideIcon; on: boolean; delay: number }[] = [
  { key: "pos", icon: ShoppingCart, on: true, delay: 500 },
  { key: "booking", icon: CalendarClock, on: true, delay: 900 },
  { key: "catalog", icon: BookOpen, on: true, delay: 1300 },
  { key: "inventory", icon: Package, on: true, delay: 1700 },
  { key: "expenses", icon: Receipt, on: false, delay: 0 },
  { key: "scheduling", icon: CalendarClock, on: false, delay: 0 },
];

// FACTS: real things the app does, shown under the form so the page says what Isnabero is
const FACTS: { key: "offline" | "roles" | "audit"; icon: LucideIcon }[] = [
  { key: "offline", icon: WifiOff },
  { key: "roles", icon: ShieldCheck },
  { key: "audit", icon: History },
];

// BrandMark: the shop icon used on every auth screen
function BrandMark({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-card ring-1 ring-white/15 ${className ?? "h-10 w-10"}`}>
      <Store className="h-5 w-5" />
    </div>
  );
}

// AuthShell: shared frame for the sign-in and set-password pages — brand panel on large screens, form column on the right
export function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="auth-panel relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex xl:p-14" aria-hidden="true">
        <div className="flex items-center gap-3">
          <BrandMark />
          <span className="font-display text-xl font-semibold">Isnabero</span>
        </div>

        <div className="space-y-8">
          <div className="grid max-w-lg grid-cols-3 gap-3">
            {MODULE_TILES.map(({ key, icon: Icon, on, delay }) => (
              <div
                key={key}
                data-on={on}
                style={{ "--d": `${delay}ms` } as CSSProperties}
                className="auth-tile flex aspect-square flex-col justify-between rounded-xl border p-3"
              >
                <Icon className="h-5 w-5" />
                <div className="space-y-2">
                  <span className="auth-switch block h-4 w-7 rounded-full border p-px">
                    <span className="auth-knob block h-3 w-3 rounded-full bg-current" />
                  </span>
                  <p className="text-xs font-medium leading-tight">{t(`modules.${key}.label`)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="max-w-lg space-y-3">
            <h2 className="font-display text-3xl font-semibold leading-tight text-balance">{t("auth.panel.title")}</h2>
            <p className="text-sm leading-relaxed text-sidebar-muted">{t("auth.panel.description")}</p>
          </div>
        </div>

        <p className="text-xs text-sidebar-muted">{t("auth.panel.footer")}</p>
      </aside>

      <main className="auth-surface flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <span className="font-display text-xl font-semibold">Isnabero</span>
          </div>
          {/* the form sits on a receipt-style sheet: maroon top edge, torn bottom edge */}
          <div className="auth-sheet-wrap">
            <div className="auth-sheet p-7 sm:p-9">{children}</div>
          </div>

          <ul className="mt-12 space-y-4">
            {FACTS.map(({ key, icon: Icon }) => (
              <li key={key} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{t(`auth.facts.${key}.title`)}</p>
                  <p className="text-sm text-muted-foreground">{t(`auth.facts.${key}.description`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
