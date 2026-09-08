import type { LucideIcon } from "lucide-react";
import { ShoppingCart, CalendarClock, LayoutGrid } from "lucide-react";

// ModuleKey mirrors packages/db's moduleKeyEnum — keep these two lists in sync when adding a new module.
// "online_store" | "inventory" | "expenses" exist in the DB enum already so schema/toggles are ready,
// but have no route/registry entry yet since those modules aren't built — add an entry here once they are.
export type ModuleKey = "catalog" | "pos" | "booking" | "online_store" | "inventory" | "expenses";

export interface ModuleDefinition {
  key: ModuleKey;
  label: string; // sidebar label
  path: string; // route path, relative to /app
  icon: LucideIcon;
}

// MODULE_REGISTRY: every add/remove module the sidebar can show. A module only renders if it's both
// registered here AND enabled=true in the business_modules table for the current tenant.
export const MODULE_REGISTRY: ModuleDefinition[] = [
  { key: "catalog", label: "Catalog", path: "/app/catalog", icon: LayoutGrid },
  { key: "pos", label: "POS / Cashier", path: "/app/pos", icon: ShoppingCart },
  { key: "booking", label: "Booking", path: "/app/booking", icon: CalendarClock },
];
