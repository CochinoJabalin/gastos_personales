import es from "../messages/es.json";

const messages: Record<string, Record<string, unknown>> = {
  es,
};

const defaultLocale = "es";

function getNestedValue(obj: unknown, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return typeof current === "string" ? current : path;
}

export function t(key: string, locale = defaultLocale): string {
  const dict = messages[locale];
  if (!dict) return key;
  return getNestedValue(dict, key);
}

export function tWithVars(
  key: string,
  vars: Record<string, string | number>,
  locale = defaultLocale
): string {
  let text = t(key, locale);
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(`{${k}}`, String(v));
  }
  return text;
}
