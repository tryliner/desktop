import { Emoji } from "react-apple-emojis";
import type { SelectOption } from "@/shared/ui/Select";
import type { Locale } from "./locale";

// shared locale options used across auth-wall and settings modal
export const LOCALE_OPTIONS: SelectOption<Locale>[] = [
  {
    value: "en",
    label: "English",
    icon: <Emoji name="flag-united-kingdom" width={16} />,
  },
  {
    value: "es",
    label: "Español",
    icon: <Emoji name="flag-spain" width={16} />,
  },
  {
    value: "ru",
    label: "Русский",
    icon: <Emoji name="flag-russia" width={16} />,
  },
  {
    value: "uk",
    label: "Українська",
    icon: <Emoji name="flag-ukraine" width={16} />,
  },
  {
    value: "de",
    label: "Deutsch",
    icon: <Emoji name="flag-germany" width={16} />,
  },
  {
    value: "it",
    label: "Italiano",
    icon: <Emoji name="flag-italy" width={16} />,
  },
  {
    value: "fr",
    label: "Français",
    icon: <Emoji name="flag-france" width={16} />,
  },
  {
    value: "pl",
    label: "Polski",
    icon: <Emoji name="flag-poland" width={16} />,
  },
  {
    value: "tr",
    label: "Türkçe",
    icon: <Emoji name="flag-turkey" width={16} />,
  },
  {
    value: "pt",
    label: "Português (Brasil)",
    icon: <Emoji name="flag-brazil" width={16} />,
  },
  {
    value: "id",
    label: "Bahasa Indonesia",
    icon: <Emoji name="flag-indonesia" width={16} />,
  },
];
