import type { en } from "./locales/en";

// Dictionary shape: nested objects whose leaves are strings, derived from the English dictionary (the only one).
export type DeepStrings<T> = { [K in keyof T]: T[K] extends string ? string : DeepStrings<T[K]> };
export type Dictionary = DeepStrings<typeof en>;

type Paths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Paths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = Paths<typeof en>;
export type TranslationParams = Record<string, string | number>;

const lookup = (dictionary: unknown, key: string): string | undefined => {
  let node: unknown = dictionary;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
};

// translate: looks the key up (falling back to the key itself so a gap is visible, never blank) and fills
// {placeholders}. A value like "1 item|{count} items" is a plural: the first form is used when params.count is 1.
export function translate(dictionary: Dictionary, key: TranslationKey, params?: TranslationParams): string {
  let text = lookup(dictionary, key) ?? key;
  if (text.includes("|")) {
    const [one, other = one] = text.split("|") as [string, string?];
    text = params?.count === 1 ? one : other;
  }
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match)) : text;
}

// Form validators (zod) are built once at import time, before the text is looked up. They carry a *message token*
// instead of text, and the form turns the token into text when it renders the error.
const TOKEN = "i18n:";

export function msg(key: TranslationKey, params?: TranslationParams): string {
  return `${TOKEN}${key}${params ? `|${JSON.stringify(params)}` : ""}`;
}

export function decodeMessage(message: string): { key: TranslationKey; params?: TranslationParams } | null {
  if (!message.startsWith(TOKEN)) return null;
  const body = message.slice(TOKEN.length);
  const split = body.indexOf("|");
  if (split === -1) return { key: body as TranslationKey };
  try {
    return { key: body.slice(0, split) as TranslationKey, params: JSON.parse(body.slice(split + 1)) as TranslationParams };
  } catch {
    return { key: body.slice(0, split) as TranslationKey };
  }
}

// flattenKeys: every dotted key in a dictionary (used by tests and the review export)
export function flattenKeys(node: unknown, prefix = ""): string[] {
  if (typeof node === "string") return [prefix];
  if (typeof node !== "object" || node === null) return [];
  return Object.entries(node).flatMap(([key, value]) => flattenKeys(value, prefix ? `${prefix}.${key}` : key));
}

export const getText = lookup;
