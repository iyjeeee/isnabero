import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Wallet, Calculator, Contact, Users, BarChart3, ScrollText, Settings } from "lucide-react";
import type { Permission } from "@/lib/permissions";
import type { ModuleKey } from "@/lib/module-registry";
import type { TranslationKey } from "@/i18n";

// NavEntry: a fixed page (labelKey + path + icon) or a module page (moduleKey; label/path/icon come from MODULE_REGISTRY)
export type NavEntry =
  | { type: "page"; labelKey: TranslationKey; path: string; icon: LucideIcon; permission?: Permission; requiresModule?: ModuleKey } // requiresModule: hidden unless that module is on
  | { type: "module"; moduleKey: ModuleKey };

export interface NavGroup {
  id: string;
  labelKey?: TranslationKey; // no label = pinned at the top without a heading
  entries: NavEntry[];
}

// NAV_GROUPS: sidebar grouped by what the person is doing, not by how the code is organised; empty groups are hidden
export const NAV_GROUPS: NavGroup[] = [
  { id: "overview", entries: [{ type: "page", labelKey: "nav.dashboard", path: "/app", icon: LayoutDashboard }] },
  {
    id: "sales",
    labelKey: "nav.groups.sales",
    entries: [
      { type: "module", moduleKey: "pos" },
      { type: "module", moduleKey: "booking" },
      { type: "page", labelKey: "nav.customers", path: "/app/customers", icon: Contact, requiresModule: "booking" },
      { type: "page", labelKey: "nav.payments", path: "/app/payments", icon: Wallet },
      { type: "page", labelKey: "nav.cashClose", path: "/app/cash-close", icon: Calculator },
    ],
  },
  { id: "products", labelKey: "nav.groups.products", entries: [{ type: "module", moduleKey: "catalog" }, { type: "module", moduleKey: "inventory" }] },
  {
    id: "team",
    labelKey: "nav.groups.team",
    entries: [{ type: "page", labelKey: "nav.employees", path: "/app/employees", icon: Users }, { type: "module", moduleKey: "scheduling" }],
  },
  {
    id: "finance",
    labelKey: "nav.groups.finance",
    entries: [
      { type: "module", moduleKey: "expenses" },
      { type: "page", labelKey: "nav.reports", path: "/app/reports", icon: BarChart3 },
      { type: "page", labelKey: "nav.audit", path: "/app/audit", icon: ScrollText, permission: "audit.view" },
    ],
  },
];

// SETTINGS_ENTRY: configuration, not daily work — opened as a modal from Settings instead of being a page or a sidebar item
export const SETTINGS_ENTRY: { labelKey: TranslationKey; icon: LucideIcon; permission: Permission } = {
  labelKey: "nav.setup",
  icon: Settings,
  permission: "business.configure",
};
