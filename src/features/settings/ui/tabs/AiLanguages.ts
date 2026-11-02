export interface LanguageOption {
  value: string;
  label: string;
  native: string;
}

export const TARGET_LANG_OPTIONS: LanguageOption[] = [
  { value: "vi", label: "Vietnamese", native: "Tiếng Việt" },
  { value: "en", label: "English", native: "English" },
  { value: "ja", label: "Japanese", native: "日本語" },
  { value: "ko", label: "Korean", native: "한국어" },
  { value: "zh", label: "Chinese (Simplified)", native: "简体中文" },
  { value: "zh-TW", label: "Chinese (Traditional)", native: "繁體中文" },
  { value: "es", label: "Spanish", native: "Español" },
  { value: "fr", label: "French", native: "Français" },
  { value: "de", label: "German", native: "Deutsch" },
  { value: "ru", label: "Russian", native: "Русский" },
  { value: "pt", label: "Portuguese", native: "Português" },
  { value: "it", label: "Italian", native: "Italiano" },
  { value: "id", label: "Indonesian", native: "Bahasa Indonesia" },
  { value: "th", label: "Thai", native: "ไทย" },
  { value: "hi", label: "Hindi", native: "हिन्दी" },
  { value: "ar", label: "Arabic", native: "العربية" },
  { value: "tr", label: "Turkish", native: "Türkçe" },
  { value: "tl", label: "Filipino", native: "Tagalog" },
  { value: "pl", label: "Polish", native: "Polski" },
  { value: "nl", label: "Dutch", native: "Nederlands" },
  { value: "ms", label: "Malay", native: "Bahasa Melayu" },
  { value: "sv", label: "Swedish", native: "Svenska" },
];
