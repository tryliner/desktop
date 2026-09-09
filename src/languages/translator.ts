import type { Locale } from "./locale";
import { translations } from "./data";

export type TranslationDict = Record<string, string>;

export function flatten(obj: Record<string, unknown>, prefix = ""): TranslationDict {
  const result: TranslationDict = {};
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof val === "string") {
      result[path] = val;
    } else if (val && typeof val === "object") {
      Object.assign(result, flatten(val as Record<string, unknown>, path));
    }
  }
  return result;
}

export type TFunction = (
  key: string,
  vars?: Record<string, string | number>
) => string;

const flatCaches = new Map<Locale, Record<string, string>>();
const pluralRules = new Map<Locale, Intl.PluralRules>();

function getFlatDict(locale: Locale): Record<string, string> {
  let flat = flatCaches.get(locale);
  if (!flat) {
    flat = {};
    const modules = translations[locale];
    if (modules) {
      Object.assign(flat, flatten(modules));
    }
    flatCaches.set(locale, flat);
  }
  return flat;
}

function getPluralRules(locale: Locale): Intl.PluralRules {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }
  return rules;
}

export function formatTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  let result = template;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replaceAll(`{${k}}`, String(v));
  }
  return result;
}

export function createTranslatorSync(locale: Locale): TFunction {
  const currentDict = getFlatDict(locale);
  const fallbackDict = locale === "en" ? currentDict : getFlatDict("en");
  const rules = getPluralRules(locale);

  return (key: string, vars?: Record<string, string | number>): string => {
    let template: string | undefined;

    // Handle pluralization if vars contains 'count'
    if (vars && typeof vars.count === "number") {
      const category = rules.select(vars.count);
      template =
        currentDict[`${key}_${category}`] ??
        currentDict[`${key}_plural`] ??
        fallbackDict[`${key}_${category}`] ??
        fallbackDict[`${key}_plural`];
    }

    // Direct key lookup if no plural match or no count
    if (template === undefined) {
      template = currentDict[key] ?? fallbackDict[key];
    }

    if (template === undefined) {
      return key;
    }

    return vars ? formatTemplate(template, vars) : template;
  };
}

export function t(
  dict: TranslationDict,
  key: string,
  vars?: Record<string, string | number>
): string {
  if (!dict) return key;
  let val = dict[key];
  if (val === undefined) return key;
  if (vars) val = formatTemplate(val, vars);
  return val;
}
