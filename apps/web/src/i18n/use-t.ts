import { en } from "./locales/en";
import { LOCALE } from "./locale";
import { decodeMessage, translate, type TranslationKey, type TranslationParams } from "./translate";

export type TFunction = (key: TranslationKey, params?: TranslationParams) => string;

// t: looks a key up in the English dictionary and fills {placeholders}
const t: TFunction = (key, params) => translate(en, key, params);

// tm: turns a form-validation message token (see msg()) into text; plain strings pass through untouched
const tm = (message?: string): string | undefined => {
  if (!message) return undefined;
  const decoded = decodeMessage(message);
  return decoded ? t(decoded.key, decoded.params) : message;
};

// One stable object: nothing changes at runtime, so components never re-render for it
const TEXT = { t, tm, locale: LOCALE };

// useT: `t("pos.cart.empty")`, plus `tm` for form errors and the Intl locale
export function useT() {
  return TEXT;
}

// translateNow: for code outside React (e.g. the global error toast)
export function translateNow(key: TranslationKey, params?: TranslationParams): string {
  return t(key, params);
}
