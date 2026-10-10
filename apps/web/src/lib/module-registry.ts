import type { LucideIcon } from "lucide-react";
import { ShoppingCart, CalendarClock, LayoutGrid, Receipt } from "lucide-react";
import type { Permission } from "@/lib/permissions";

// ModuleKey mirrors packages/db's moduleKeyEnum — keep these two lists in sync when adding a new module
// (module-registry.test.ts fails if a registered key is missing from the enum).
// "online_store" | "inventory" have no route/registry entry yet since those modules aren't built.
export type ModuleKey = "catalog" | "pos" | "booking" | "online_store" | "inventory" | "expenses";

export interface ModuleDefinition {
  key: ModuleKey;
  label: string; // sidebar label
  description: string; // one line shown in the setup wizard
  path: string; // route path, relative to /app
  icon: LucideIcon;
  requires?: ModuleKey[]; // modules that must be on for this one to work
  permission?: Permission; // role gate for the sidebar entry and route; omitted = every role
}

// MODULE_REGISTRY: every add/remove module the sidebar can show. A module only renders if it's both
// registered here AND enabled=true in the business_modules table for the current tenant.
export const MODULE_REGISTRY: ModuleDefinition[] = [
  { key: "catalog", label: "Catalog", description: "Menu items, products and packages shared by POS and Booking.", path: "/app/catalog", icon: LayoutGrid },
  { key: "pos", label: "POS / Cashier", description: "Ring up sales and record how customers paid.", path: "/app/pos", icon: ShoppingCart, requires: ["catalog"] },
  { key: "booking", label: "Booking", description: "Reserve time slots for customers.", path: "/app/booking", icon: CalendarClock, requires: ["catalog"] },
  { key: "expenses", label: "Expenses", description: "Track rent, utilities, supplies and other spending (owners and admins).", path: "/app/expenses", icon: Receipt, permission: "expenses.view" },
];

export function getModuleDefinition(key: ModuleKey): ModuleDefinition | undefined {
  return MODULE_REGISTRY.find((module) => module.key === key);
}

// normalizeModules: adds required modules, drops duplicates and anything not in the registry, returns registry order
export function normalizeModules(selected: ModuleKey[]): ModuleKey[] {
  const keys = new Set(selected);
  for (const module of MODULE_REGISTRY) {
    if (keys.has(module.key)) module.requires?.forEach((required) => keys.add(required));
  }
  return MODULE_REGISTRY.filter((module) => keys.has(module.key)).map((module) => module.key);
}

// dependentsOf: selected modules that need `key` — a module with dependents can't be turned off
export function dependentsOf(key: ModuleKey, selected: ModuleKey[]): ModuleDefinition[] {
  return MODULE_REGISTRY.filter((module) => selected.includes(module.key) && module.requires?.includes(key));
}
