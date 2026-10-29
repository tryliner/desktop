declare module "kuroshiro" {
  export default class Kuroshiro {
    init(analyzer: {
      init(): Promise<void>;
      parse(text: string): Promise<unknown[]>;
    }): Promise<void>;
    convert(
      text: string,
      options: { to: "romaji"; mode: "spaced"; romajiSystem: "hepburn" },
    ): Promise<string>;
  }
}

declare module "kuromoji/build/kuromoji.js" {
  export interface Tokenizer {
    tokenize(text: string): { surface_form: string; reading?: string }[];
  }
  const kuromoji: {
    builder(options: { dicPath: string }): {
      build(
        callback: (error: Error | null, tokenizer: Tokenizer) => void,
      ): void;
    };
  };
  export default kuromoji;
}

declare module "kuromoji" {
  const kuromoji: typeof import("kuromoji/build/kuromoji.js").default;
  export default kuromoji;
}
