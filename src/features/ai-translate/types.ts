export type AiProvider =
  | "gemini"
  | "claude"
  | "openai"
  | "deepseek"
  | "openrouter"
  | "ollama"
  | "openai_compatible"
  | "google_translate";

export interface TranslationConfig {
  provider: AiProvider;
  apiKey?: string;
  targetLang: string;
  model?: string;
  baseUrl?: string;
  singableMode?: boolean;
}

export interface TranslationCacheItem {
  trackId: string;
  targetLang: string;
  lines: string[];
  timestamp: number;
}
