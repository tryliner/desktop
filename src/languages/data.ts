import en from "./locales/en.json";
import ru from "./locales/ru.json";
import uk from "./locales/uk.json";
import es from "./locales/es.json";
import vi from "./locales/vi.json";
import type { Locale } from "./locale";

export const translations: Record<Locale, Record<string, unknown>> = {
  en,
  ru,
  uk,
  es,
  vi,
};
