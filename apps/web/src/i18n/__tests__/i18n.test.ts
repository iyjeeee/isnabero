import { describe, expect, it } from "vitest";
import { MODULE_REGISTRY } from "@/lib/module-registry";
import { AUDIT_ACTIONS } from "@isnabero/db";
import { en } from "../locales/en";
import { fil } from "../locales/fil";
import { detectLanguage, localeOf } from "../languages";
import { decodeMessage, flattenKeys, getText, msg, translate, type Dictionary, type TranslationKey } from "../translate";

const EN = en as Dictionary;
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
const forms = (text: string) => text.split("|").length;

// Terms that are the same in Filipino business usage
const SAME_ON_PURPOSE = new Set(["nav.audit", "audit.title", "modules.online_store.label", "enums.method.bank_transfer", "pos.checkout.referenceCode", "details.fields.reference"]);

describe("dictionaries", () => {
  const keys = flattenKeys(EN);

  it("has the same keys in English and Filipino", () => {
    expect(flattenKeys(fil).sort()).toEqual([...keys].sort());
  });

  it("keeps placeholders and plural forms identical across languages", () => {
    for (const key of keys) {
      const english = getText(EN, key)!;
      const filipino = getText(fil, key)!;
      expect(placeholders(filipino), key).toEqual(placeholders(english));
      expect(forms(filipino), key).toBe(forms(english));
    }
  });

  it("has no empty strings and no English copy left untranslated by accident", () => {
    const same = keys.filter((key) => !SAME_ON_PURPOSE.has(key) && getText(fil, key) === getText(EN, key) && /[a-z]{4,}\s[a-z]{3,}/i.test(getText(EN, key)!));
    for (const key of keys) expect(getText(fil, key)!.trim(), key).not.toBe("");
    expect(same).toEqual([]);
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
  const fallback = { a: { one: "1 item|{count} items", hi: "Hi {name}", only: "English only" } } as unknown as Dictionary;
  const t = (key: string, params?: Record<string, string | number>) => translate(dict, fallback, key as TranslationKey, params);

  it("interpolates, pluralises and falls back", () => {
    expect(t("a.hi", { name: "Ana" })).toBe("Hi Ana");
    expect(t("a.one", { count: 1 })).toBe("1 item");
    expect(t("a.one", { count: 3 })).toBe("3 items");
    expect(t("a.only")).toBe("English only");
    expect(t("a.missing")).toBe("a.missing");
  });

  it("round-trips message tokens", () => {
    expect(decodeMessage(msg("common.save"))).toEqual({ key: "common.save" });
    expect(decodeMessage(msg("schedule.form.keepUnder", { max: 5 }))).toEqual({ key: "schedule.form.keepUnder", params: { max: 5 } });
    expect(decodeMessage("plain text")).toBeNull();
  });
});

describe("language detection", () => {
  it("prefers the saved language, then Filipino browsers, then English", () => {
    expect(detectLanguage("en", ["fil-PH"])).toBe("en");
    expect(detectLanguage("fil", ["en-US"])).toBe("fil");
    expect(detectLanguage(null, ["tl-PH"])).toBe("fil");
    expect(detectLanguage(null, ["fil"])).toBe("fil");
    expect(detectLanguage(null, ["en-US", "de"])).toBe("en");
    expect(detectLanguage("xx", [])).toBe("en");
    expect(localeOf("fil")).toBe("fil-PH");
  });
});
