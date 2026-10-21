import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Badge, Button, Input, Label } from "@isnabero/ui";
import { useT } from "@/i18n";
import { MODULE_REGISTRY, type ModuleKey } from "@/lib/module-registry";
import { BUSINESS_NAME_MAX, normalizeBusinessName, validateReceiptDetails, type BusinessView, type ReceiptDetailsErrors, type ReceiptDetailsInput } from "@/lib/repositories/repository";
import { useSaveBusinessSetup } from "@/hooks/use-save-business-setup";
import { useSaveReceiptDetails } from "@/hooks/use-save-receipt-details";
import { ReceiptDetailsForm } from "@/components/receipt/ReceiptDetailsForm";
import { SetupSteps } from "@/components/setup/SetupSteps";
import { ModuleToggleList } from "@/components/setup/ModuleToggleList";

interface SetupWizardProps {
  business: BusinessView;
  enabledModules: ModuleKey[];
  onDone: () => void; // called after a successful save (the modal closes)
}

// SetupWizard: 4 steps (name -> modules -> review -> receipt details). The last step's button saves everything. Starts from the business's current values, so re-running it
// later edits the existing setup instead of starting from scratch.
export function SetupWizard({ business, enabledModules, onDone }: SetupWizardProps) {
  const { t } = useT();
  const save = useSaveBusinessSetup(business.id);
  const saveReceipt = useSaveReceiptDetails(business.id);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(business.name);
  const [modules, setModules] = useState<ModuleKey[]>(enabledModules);
  const [nameError, setNameError] = useState<string | null>(null);
  const initialReceipt: ReceiptDetailsInput = { address: business.address ?? "", tin: business.tin ?? "", contactNumber: business.contactNumber ?? "", receiptFooter: business.receiptFooter ?? "" };
  const [receipt, setReceipt] = useState<ReceiptDetailsInput>(initialReceipt);
  const [receiptErrors, setReceiptErrors] = useState<ReceiptDetailsErrors>({});
  const steps = [t("setup.steps.business"), t("setup.steps.modules"), t("setup.steps.review"), t("setup.steps.receipt")];
  const busy = save.isPending || saveReceipt.isPending;
  const isLast = step === steps.length - 1;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (step === 0) {
      // Validate here (not via normalizeBusinessName's English throw) so the message is translated
      const trimmed = name.trim();
      if (!trimmed || trimmed.length > BUSINESS_NAME_MAX) {
        setNameError(trimmed ? t("setup.business.nameTooLong", { max: BUSINESS_NAME_MAX }) : t("setup.business.nameRequired"));
        return;
      }
      setName(normalizeBusinessName(trimmed));
      setNameError(null);
    }
    if (!isLast) {
      setStep(step + 1);
      return;
    }
    void finish();
  };

  // finish: validates the receipt fields, saves name + modules, then the receipt details only if they changed (errors toast globally)
  const finish = async () => {
    const result = validateReceiptDetails(receipt);
    setReceiptErrors(result.errors);
    if (Object.keys(result.errors).length > 0) return;
    try {
      await save.mutateAsync({ name, enabledModules: modules });
      if (JSON.stringify(receipt) !== JSON.stringify(initialReceipt)) await saveReceipt.mutateAsync(receipt);
    } catch {
      return;
    }
    toast.success(t("setup.saved"));
    onDone();
  };

  const selectedDefinitions = MODULE_REGISTRY.filter((module) => modules.includes(module.key));

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-5">
        <SetupSteps steps={steps} current={step} />

        {step === 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="setup-name">{t("setup.business.name")}</Label>
            <Input
              id="setup-name"
              value={name}
              maxLength={BUSINESS_NAME_MAX}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              aria-invalid={Boolean(nameError)}
            />
            {nameError ? <p className="text-xs text-destructive">{nameError}</p> : <p className="text-xs text-muted-foreground">{t("setup.business.nameHint")}</p>}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("setup.modules.hint")}</p>
            <ModuleToggleList selected={modules} onChange={setModules} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">{t("setup.business.name")}</p>
              <p className="font-display text-lg font-semibold">{name}</p>
            </div>
            <div>
              <p className="mb-2 text-sm text-muted-foreground">{t("setup.steps.modules")}</p>
              {selectedDefinitions.length === 0 ? (
                <p className="text-sm">{t("setup.review.none")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedDefinitions.map((module) => (
                    <Badge key={module.key} variant="success" className="gap-1.5">
                      <CheckCircle2 className="h-3 w-3" />
                      {t(`modules.${module.key}.label`)}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t("setup.review.later")}</p>
          </div>
        )}

        {step === 3 && <ReceiptDetailsForm value={receipt} errors={receiptErrors} onChange={(field, text) => setReceipt((current) => ({ ...current, [field]: text }))} />}
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </Button>
        <Button type="submit" disabled={busy}>
          {isLast ? (busy ? t("common.saving") : t("setup.finish")) : t("common.next")}
          {!isLast && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </form>
  );
}
