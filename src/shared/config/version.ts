// app version sourced from package.json and vite compile-time define
import pkg from "../../../package.json";

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : pkg.version || "0.1.29";
