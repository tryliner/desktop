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
    value: "ru",
    label: "Русский",
    icon: <Emoji name="flag-russia" width={16} />,
  },
  {
    value: "uk",
    label: "Українська",
    icon: <Emoji name="flag-ukraine" width={16} />,
  },
];
