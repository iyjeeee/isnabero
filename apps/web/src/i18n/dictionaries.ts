import { en } from "./locales/en";
import { fil } from "./locales/fil";
import type { Language } from "./languages";
import type { Dictionary } from "./translate";

export const DICTIONARIES: Record<Language, Dictionary> = { en, fil };
