import { createReadStream } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import type { Plugin } from "vite";

const require = createRequire(import.meta.url);
const kuromojiRoot = path.dirname(require.resolve("kuromoji/package.json"));
const kuroshiroRoot = path.dirname(require.resolve("kuroshiro/package.json"));
const prefix = "/kuromoji-dict/";

async function dictionaryFiles() {
  const files = new Map<string, string>();
  for (const name of await readdir(path.join(kuromojiRoot, "dict"))) {
    if (name.endsWith(".dat.gz"))
      files.set(name, path.join(kuromojiRoot, "dict", name));
  }
  for (const name of ["NOTICE.md", "LICENSE-2.0.txt"])
    files.set(name, path.join(kuromojiRoot, name));
  files.set("kuroshiro-LICENSE.txt", path.join(kuroshiroRoot, "LICENSE"));
  return files;
}

export function japaneseDictionaryPlugin(): Plugin {
  return {
    name: "liner-japanese-dictionary",
    async configureServer(server) {
      const files = await dictionaryFiles();
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        if (!url.pathname.startsWith(prefix)) return next();
        const file = files.get(url.pathname.slice(prefix.length));
        if (!file) {
          response.statusCode = 404;
          response.end();
          return;
        }
        response.setHeader("Content-Type", "application/octet-stream");
        createReadStream(file).on("error", next).pipe(response);
      });
    },
    async generateBundle() {
      for (const [name, file] of await dictionaryFiles()) {
        this.emitFile({
          type: "asset",
          fileName: `kuromoji-dict/${name}`,
          source: await readFile(file),
        });
      }
    },
  };
}
