import { describe, expect, it } from "vitest";
import { MODULE_REGISTRY } from "@/lib/module-registry";
import { AUDIT_ACTIONS } from "@isnabero/db";
import { en } from "../locales/en";
import { decodeMessage, flattenKeys, getText, msg, translate, type Dictionary, type TranslationKey } from "../translate";

const EN = en as Dictionary;
const forms = (text: string) => text.split("|").length;

describe("dictionary", () => {
  const keys = flattenKeys(EN);

  it("has no empty strings", () => {
    for (const key of keys) expect(getText(EN, key)!.trim(), key).not.toBe("");
  });

  it("uses well-formed placeholders and at most two plural forms", () => {
    for (const key of keys) {
      const text = getText(EN, key)!;
      expect(text.replace(/\{\w+\}/g, "").includes("{"), key).toBe(false);
      expect(forms(text), key).toBeLessThanOrEqual(2);
    }
  });

  it("covers every module and audit action", () => {
    for (const module of MODULE_REGISTRY) {
      expect(getText(EN, `modules.${module.key}.label`), module.key).toBeTruthy();
      expect(getText(EN, `modules.${module.key}.description`), module.key).toBeTruthy();
    }
    for (const action of Object.keys(AUDIT_ACTIONS)) expect(getText(EN, `enums.auditAction.${action.replace(".", "_")}`), action).toBeTruthy();
  });
});

describe("translate", () => {
  const dict = { a: { one: "1 item|{count} items", hi: "Hi {name}" } } as unknown as Dictionary;
  const t = (key: string, params?: Record<string, string | number>) => translate(dict, key as TranslationKey, params);

  it("interpolates, pluralises and shows the key when it is missing", () => {
    expect(t("a.hi", { name: "Ana" })).toBe("Hi Ana");
    expect(t("a.one", { count: 1 })).toBe("1 item");
    expect(t("a.one", { count: 3 })).toBe("3 items");
    expect(t("a.missing")).toBe("a.missing");
  });

  it("round-trips message tokens", () => {
    expect(decodeMessage(msg("common.save"))).toEqual({ key: "common.save" });
    expect(decodeMessage(msg("schedule.form.keepUnder", { max: 5 }))).toEqual({ key: "schedule.form.keepUnder", params: { max: 5 } });
    expect(decodeMessage("plain text")).toBeNull();
  });
});
