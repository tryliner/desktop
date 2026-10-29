import kuromoji from "kuromoji/build/kuromoji.js";
import { createJapaneseConverter } from "./japaneseConverter";
import type { JapaneseRequest, JapaneseResponse } from "./japaneseTypes";

let ready: ReturnType<typeof createJapaneseConverter> | null = null;

self.onmessage = async (event: MessageEvent<JapaneseRequest>) => {
  const { id, texts, dictionaryPath } = event.data;
  try {
    ready ??= new Promise<Parameters<typeof createJapaneseConverter>[0]>(
      (resolve, reject) => {
        kuromoji
          .builder({ dicPath: dictionaryPath })
          .build((error, tokenizer) => {
            if (error) reject(error);
            else resolve(tokenizer);
          });
      },
    ).then(createJapaneseConverter);
    const convert = await ready;
    const results = await Promise.all(texts.map(convert));
    self.postMessage({ id, results } satisfies JapaneseResponse);
  } catch (error) {
    ready = null;
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    } satisfies JapaneseResponse);
  }
};
