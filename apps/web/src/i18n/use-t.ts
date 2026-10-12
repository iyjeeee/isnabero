import { useMemo } from "react";
import { useLanguageStore } from "@/stores/language-store";
import { DICTIONARIES } from "./dictionaries";
import { localeOf, type Language } from "./languages";
import { decodeMessage, translate, type TranslationKey, type TranslationParams } from "./translate";

export type TFunction = (key: TranslationKey, params?: TranslationParams) => string;

function makeT(language: Language): TFunction {
  const dictionary = DICTIONARIES[language];
  return (key, params) => translate(dictionary, DICTIONARIES.en, key, params);
}

// tm: turns a form-validation message token (see msg()) into text; plain strings pass through untouched
function makeTm(t: TFunction) {
  return (message?: string): string | undefined => {
    if (!message) return undefined;
    const decoded = decodeMessage(message);
    return decoded ? t(decoded.key, decoded.params) : message;
  };
}

// useT: `t("pos.cart.empty")` in the current language, plus `tm` for form errors, the language itself and its Intl locale.
export function useT() {
  const language = useLanguageStore((state) => state.language);
  return useMemo(() => {
    const t = makeT(language);
    return { t, tm: makeTm(t), language, locale: localeOf(language) };
  }, [language]);
}

// translateNow: for code outside React (e.g. the global error toast); reads the current language at call time
export function translateNow(key: TranslationKey, params?: TranslationParams): string {
  return makeT(useLanguageStore.getState().language)(key, params);
}
