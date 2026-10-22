import { Badge, Switch } from "@isnabero/ui";
import { useT } from "@/i18n";
import { MODULE_REGISTRY, dependentsOf, normalizeModules, type ModuleKey } from "@/lib/module-registry";

interface ModuleToggleListProps {
  selected: ModuleKey[];
  onChange: (next: ModuleKey[]) => void;
}

// ModuleToggleList: one switch per registered module. Turning a module on also turns on what it needs (POS/Booking
// need Catalog); a module that another selected module needs is locked on and says why.
export function ModuleToggleList({ selected, onChange }: ModuleToggleListProps) {
  const { t } = useT();
  const toggle = (key: ModuleKey, on: boolean) => {
    onChange(on ? normalizeModules([...selected, key]) : selected.filter((item) => item !== key));
  };

  return (
    <ul className="space-y-3">
      {MODULE_REGISTRY.map((module) => {
        const isOn = selected.includes(module.key);
        const dependents = dependentsOf(module.key, selected);
        const locked = isOn && dependents.length > 0;
        return (
          <li key={module.key} className="flex items-center gap-4 rounded-lg border bg-card p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <module.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <p className="font-medium">{t(`modules.${module.key}.label`)}</p>
                {locked && <Badge variant="secondary" className="whitespace-normal rounded-lg text-left">{t("setup.modules.neededBy", { modules: dependents.map((item) => t(`modules.${item.key}.label`)).join(", ") })}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{t(`modules.${module.key}.description`)}</p>
            </div>
            <Switch checked={isOn} disabled={locked} onCheckedChange={(on) => toggle(module.key, on)} aria-label={t("setup.modules.switchAria", { module: t(`modules.${module.key}.label`) })} />
          </li>
        );
      })}
    </ul>
  );
}
