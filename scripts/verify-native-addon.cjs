// CI guard for the windows 11 snap / window animation add-on (native/snap-preview).
// Loads the built .node and checks it exports every function electron/snap-native.ts
// requires, so a release can't ship an outdated or broken build (the app would fall
// back to the plain preview silently). Usage: node scripts/verify-native-addon.cjs [path]
const path = require("node:path");
const fs = require("node:fs");

const file = path.resolve(
  process.argv[2] || path.join(__dirname, "..", "native", "snap-preview", "build", "Release", "snap_preview.node"),
);

// keep in sync with the `required` list in electron/snap-native.ts (loadSnapPreviewAddon)
const REQUIRED = [
  "init",
  "placeOnCursorMonitor",
  "placeOnWindowMonitor",
  "windowRect",
  "animate",
  "setTarget",
  "show",
  "hide",
  "beginMorph",
  "runMorph",
  "endMorph",
  "setMorphTarget",
  "revealMorph",
  "cloak",
  "transform",
  "endTransform",
];

if (process.platform !== "win32") {
  console.log("verify-native-addon: not windows, skipped");
  process.exit(0);
}
if (!fs.existsSync(file)) {
  console.error(`verify-native-addon: missing ${file}`);
  process.exit(1);
}
let addon;
try {
  addon = require(file);
} catch (err) {
  console.error(`verify-native-addon: failed to load ${file}\n${err && err.stack ? err.stack : err}`);
  process.exit(1);
}
const missing = REQUIRED.filter((name) => typeof addon[name] !== "function");
if (missing.length) {
  console.error(`verify-native-addon: ${file} is missing: ${missing.join(", ")} (outdated build?)`);
  process.exit(1);
}
console.log(`verify-native-addon: ok (${REQUIRED.length} functions) ${file}`);
