export function getRendererMode(options: {
  devServerUrl?: string;
  localTestBuild: boolean;
}): "development" | "bundled" | "ota" {
  if (options.devServerUrl) return "development";
  return options.localTestBuild ? "bundled" : "ota";
}
