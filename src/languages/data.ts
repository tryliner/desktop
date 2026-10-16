import en from "./locales/en.json";
import ru from "./locales/ru.json";
import uk from "./locales/uk.json";
import pt_br from "./locales/pt_br.json";
import type { Locale } from "./locale";

export const translations: Record<Locale, Record<string, unknown>> = {
  en,
  ru,
  uk,
  pt_br
};
