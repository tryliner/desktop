import {
  translateWithOpenAiCompatible,
  romanizeWithOpenAiCompatible,
} from "./openAiProvider";

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1";
const DEFAULT_OLLAMA_MODEL = "llama3.2";

export function translateWithOllama(
  lines: string[],
  apiKey: string | undefined,
  targetLang: string,
  baseUrl?: string,
  model?: string,
  singable = false,
): Promise<string[]> {
  const url = baseUrl?.trim() || DEFAULT_OLLAMA_BASE_URL;
  const chosenModel = model?.trim() || DEFAULT_OLLAMA_MODEL;
  return translateWithOpenAiCompatible(
    lines,
    apiKey?.trim() || "ollama",
    targetLang,
    url,
    chosenModel,
    singable,
  );
}

export function romanizeWithOllama(
  lines: string[],
  apiKey: string | undefined,
  baseUrl?: string,
  model?: string,
): Promise<string[]> {
  const url = baseUrl?.trim() || DEFAULT_OLLAMA_BASE_URL;
  const chosenModel = model?.trim() || DEFAULT_OLLAMA_MODEL;
  return romanizeWithOpenAiCompatible(
    lines,
    apiKey?.trim() || "ollama",
    url,
    chosenModel,
  );
}
