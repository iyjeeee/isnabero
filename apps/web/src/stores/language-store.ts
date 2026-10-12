import { create } from "zustand";
import { DEFAULT_LANGUAGE, detectLanguage, localeOf, type Language } from "@/i18n/languages";

const STORAGE_KEY = "isnabero-language";

// Storage can be blocked (private windows, strict settings): reading or writing then just skips saving
const readSaved = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

function applyLanguage(language: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // not saved this time; the choice still applies for this visit
  }
  document.documentElement.lang = localeOf(language);
}

function getInitialLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const language = detectLanguage(readSaved(), navigator.languages ?? [navigator.language]);
  document.documentElement.lang = localeOf(language);
  return language;
}

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
}

// useLanguageStore: the chosen display language (English or Filipino), remembered per browser
export const useLanguageStore = create<LanguageState>((set) => ({
  language: getInitialLanguage(),
  setLanguage: (language) => {
    applyLanguage(language);
    set({ language });
  },
}));
