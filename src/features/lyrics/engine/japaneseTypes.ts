export type JapaneseTokenizer = import("kuromoji/build/kuromoji.js").Tokenizer;

export interface JapaneseRequest {
  id: number;
  texts: string[];
  dictionaryPath: string;
}

export interface JapaneseResponse {
  id: number;
  results?: string[];
  error?: string;
}
