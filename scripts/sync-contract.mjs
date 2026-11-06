// copies the api's generated contract (contract/api.generated.ts) into the client.
// LINER_API_DIR points at the api checkout, ../api by default
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const apiDir = resolve(process.env.LINER_API_DIR ?? "../api");
const source = resolve(apiDir, "contract/api.generated.ts");
const target = resolve("src/shared/contracts/api.generated.ts");

if (!existsSync(source)) {
  console.error(
    `No contract at ${source}, set LINER_API_DIR to the api checkout`,
  );
  process.exit(1);
}
copyFileSync(source, target);
console.log(`Contract copied from ${source}`);
