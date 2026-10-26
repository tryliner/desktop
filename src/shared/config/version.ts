import pkg from "../../../package.json";

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined"
    ? __APP_VERSION__
    : pkg.version || "0.2.10";
