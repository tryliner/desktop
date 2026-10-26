// builds the windows 11 snap preview add-on (native/snap-preview), then checks it with
// verify-native-addon.cjs. In CI a failure stops the build, so a release never ships without
// it. On a dev machine without Visual Studio C++ it only warns: the app falls back to the
// plain preview (electron/snap-native.ts), so contributors can still build the app.
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.join(__dirname, "..");
const strict = Boolean(process.env.CI);

// fixed command lines only (shell: pnpm is a .cmd shim on windows)
function run(commandLine) {
  return spawnSync(commandLine, { cwd: root, stdio: "inherit", shell: true }).status === 0;
}

if (process.platform !== "win32") {
  console.log("build-native-addon: not windows, skipped");
  process.exit(0);
}

const built =
  run("pnpm dlx node-gyp@12 rebuild --directory native/snap-preview") && run("node scripts/verify-native-addon.cjs");

if (!built) {
  if (strict) {
    console.error("build-native-addon: failed (CI)");
    process.exit(1);
  }
  console.warn(
    "build-native-addon: the snap preview add-on could not be built (needs Visual Studio 2022 or Build Tools with " +
      '"Desktop development with C++"). Continuing without it: the app uses the plain preview. Set CI=1 to make this fatal.',
  );
}
