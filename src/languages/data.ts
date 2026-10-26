import en from "./locales/en.json";
import ru from "./locales/ru.json";
import uk from "./locales/uk.json";
import es from "./locales/es.json";
import de from "./locales/de.json";
import it from "./locales/it.json";
import fr from "./locales/fr.json";
import pl from "./locales/pl.json";
import tr from "./locales/tr.json";
import pt from "./locales/pt.json";
import id from "./locales/id.json";
import type { Locale } from "./locale";

export const translations: Record<Locale, Record<string, unknown>> = {
  en,
  ru,
  uk,
  es,
  de,
  it,
  fr,
  pl,
  tr,
  pt,
  id,
};
