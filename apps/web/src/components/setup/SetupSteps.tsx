import { Check } from "lucide-react";
import { cn } from "@isnabero/ui";
import { useT } from "@/i18n";

interface SetupStepsProps {
  steps: string[];
  current: number; // zero-based index of the active step
}

// SetupSteps: numbered progress indicator for the setup wizard — done steps show a check, labels collapse on mobile
export function SetupSteps({ steps, current }: SetupStepsProps) {
  const { t } = useT();
  return (
    <ol className="flex items-center gap-2" aria-label={t("setup.progress")}>
      {steps.map((label, index) => {
        const isDone = index < current;
        const isCurrent = index === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2 last:flex-none" aria-current={isCurrent ? "step" : undefined}>
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                isDone && "bg-primary text-primary-foreground",
                isCurrent && "bg-primary/10 text-primary ring-2 ring-primary",
                !isDone && !isCurrent && "bg-muted text-muted-foreground",
              )}
            >
              {isDone ? <Check className="h-4 w-4" /> : index + 1}
            </span>
            <span className={cn("text-sm font-medium", isCurrent ? "text-foreground" : "hidden text-muted-foreground sm:inline")}>{label}</span>
            {index < steps.length - 1 && <span className={cn("h-px flex-1", isDone ? "bg-primary" : "bg-border")} />}
          </li>
        );
      })}
    </ol>
  );
}
