// fails when src/shared/contracts/api.generated.ts differs from the api's contract/api.generated.ts,
// so the client never builds against a contract the api does not answer.
// LINER_API_DIR points at the api checkout and makes a difference fail (CI sets it);
// without it ../api is read and a difference only warns, that checkout may be on another branch.
// fix a difference with pnpm contract:sync
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const explicit = process.env.LINER_API_DIR?.trim();
const apiDir = resolve(explicit || "../api");
const theirs = resolve(apiDir, "contract/api.generated.ts");
const ours = resolve("src/shared/contracts/api.generated.ts");

if (!existsSync(theirs)) {
  if (explicit) {
    console.error(`No contract at ${theirs}`);
    process.exit(1);
  }
  console.log(
    `No api checkout at ${apiDir}, contract check skipped (set LINER_API_DIR)`,
  );
  process.exit(0);
}

const a = readFileSync(ours, "utf8").replace(/\r\n/g, "\n").split("\n");
const b = readFileSync(theirs, "utf8").replace(/\r\n/g, "\n").split("\n");
if (a.join("\n") === b.join("\n")) {
  console.log(`Contract equals ${theirs}`);
  process.exit(0);
}

const line = a.findIndex((text, i) => text !== b[i]);
const at = line === -1 ? Math.min(a.length, b.length) : line;
const message = [
  `src/shared/contracts/api.generated.ts differs from ${theirs} at line ${at + 1}`,
  `  client: ${a[at] ?? "(end of file)"}`,
  `  api:    ${b[at] ?? "(end of file)"}`,
  "  run pnpm contract:sync",
].join("\n");
if (explicit) {
  console.error(message);
  process.exit(1);
}
console.log(`${message}\n  (warning only, set LINER_API_DIR to make it fail)`);
