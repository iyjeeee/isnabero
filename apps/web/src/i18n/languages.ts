// The languages the app can be shown in. `locale` is the BCP-47 tag handed to Intl for dates and numbers.
export const LANGUAGES = [
  { code: "en", label: "English", locale: "en-PH" },
  { code: "fil", label: "Filipino", locale: "fil-PH" },
] as const;

export type Language = (typeof LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: Language = "en";

export const isLanguage = (value: unknown): value is Language => LANGUAGES.some((language) => language.code === value);

export const localeOf = (language: Language): string => LANGUAGES.find((item) => item.code === language)?.locale ?? "en-PH";

// detectLanguage: a saved choice wins; otherwise Filipino/Tagalog browsers get Filipino, everyone else English
export function detectLanguage(saved: string | null | undefined, browserLanguages: readonly string[] = []): Language {
  if (isLanguage(saved)) return saved;
  const prefers = browserLanguages.some((tag) => /^(fil|tl)(-|$)/i.test(tag));
  return prefers ? "fil" : DEFAULT_LANGUAGE;
}
