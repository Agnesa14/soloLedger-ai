import en from "./translations/en";
import sq from "./translations/sq";

export const translations = {
  en,
  sq,
} as const;

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof en;

export function interpolate(template: string, values?: Record<string, string | number>) {
  if (!values) return template;

  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{{${key}}}`, String(value));
  }, template);
}
