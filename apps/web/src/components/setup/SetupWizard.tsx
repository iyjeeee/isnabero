import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Badge, Button, Card, CardContent, Input, Label } from "@isnabero/ui";
import { MODULE_REGISTRY, type ModuleKey } from "@/lib/module-registry";
import { BUSINESS_NAME_MAX, normalizeBusinessName, type BusinessView } from "@/lib/repositories/repository";
import { useSaveBusinessSetup } from "@/hooks/use-save-business-setup";
import { SetupSteps } from "@/components/setup/SetupSteps";
import { ModuleToggleList } from "@/components/setup/ModuleToggleList";

const STEPS = ["Business", "Modules", "Review"];

interface SetupWizardProps {
  business: BusinessView;
  enabledModules: ModuleKey[];
}

// SetupWizard: 3 steps (name -> modules -> review). Starts from the business's current values, so re-running it
// later edits the existing setup instead of starting from scratch.
export function SetupWizard({ business, enabledModules }: SetupWizardProps) {
  const navigate = useNavigate();
  const save = useSaveBusinessSetup(business.id);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(business.name);
  const [modules, setModules] = useState<ModuleKey[]>(enabledModules);
  const [nameError, setNameError] = useState<string | null>(null);
  const isLast = step === STEPS.length - 1;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (step === 0) {
      try {
        setName(normalizeBusinessName(name));
        setNameError(null);
      } catch (error) {
        setNameError((error as Error).message);
        return;
      }
    }
    if (!isLast) {
      setStep(step + 1);
      return;
    }
    save.mutate(
      { name, enabledModules: modules },
      {
        onSuccess: () => {
          toast.success("Business setup saved");
          navigate("/app");
        },
      },
    );
  };

  const selectedDefinitions = MODULE_REGISTRY.filter((module) => modules.includes(module.key));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="space-y-6 p-6">
          <SetupSteps steps={STEPS} current={step} />

          {step === 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="setup-name">Business name</Label>
              <Input
                id="setup-name"
                value={name}
                maxLength={BUSINESS_NAME_MAX}
                autoFocus
                onChange={(event) => setName(event.target.value)}
                aria-invalid={Boolean(nameError)}
              />
              {nameError ? <p className="text-xs text-destructive">{nameError}</p> : <p className="text-xs text-muted-foreground">Shown in the sidebar and on your pages.</p>}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Turn on the features this business needs. Payment records, employees and reports are always included.</p>
              <ModuleToggleList selected={modules} onChange={setModules} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Business name</p>
                <p className="font-display text-lg font-semibold">{name}</p>
              </div>
              <div>
                <p className="mb-2 text-sm text-muted-foreground">Modules</p>
                {selectedDefinitions.length === 0 ? (
                  <p className="text-sm">None — only the always-on features will show.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedDefinitions.map((module) => (
                      <Badge key={module.key} variant="success" className="gap-1.5">
                        <CheckCircle2 className="h-3 w-3" />
                        {module.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">You can change any of this later from Business Setup in the sidebar.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" disabled={step === 0 || save.isPending} onClick={() => setStep(step - 1)}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {isLast ? (save.isPending ? "Saving…" : "Finish setup") : "Next"}
          {!isLast && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </form>
  );
}
