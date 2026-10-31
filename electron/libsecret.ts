import fs from "node:fs";
import path from "node:path";

export const LIBSECRET_SONAME = "libsecret-1.so.0";
const LIBRARY_DIRS = [
  "/usr/lib64",
  "/usr/lib",
  "/lib64",
  "/lib",
  "/usr/local/lib",
];
const MULTIARCH_TRIPLETS: Partial<Record<NodeJS.Architecture, string>> = {
  x64: "x86_64-linux-gnu",
  arm64: "aarch64-linux-gnu",
  arm: "arm-linux-gnueabihf",
  ia32: "i386-linux-gnu",
};

export type LibsecretProbe = {
  exists: (file: string) => boolean;
  libraryPath?: string;
  arch: NodeJS.Architecture;
};

export function libsecretCandidates(
  libraryPath: string | undefined,
  arch: NodeJS.Architecture,
): string[] {
  const triplet = MULTIARCH_TRIPLETS[arch];
  const dirs = [
    ...(libraryPath ?? "").split(":").filter(Boolean),
    ...LIBRARY_DIRS.flatMap((dir) =>
      triplet ? [path.posix.join(dir, triplet), dir] : [dir],
    ),
  ];
  return [...new Set(dirs)].map((dir) =>
    path.posix.join(dir, LIBSECRET_SONAME),
  );
}

export function hasLibsecret(
  probe: LibsecretProbe = {
    exists: (file) => fs.existsSync(file),
    libraryPath: process.env.LD_LIBRARY_PATH,
    arch: process.arch,
  },
): boolean {
  return libsecretCandidates(probe.libraryPath, probe.arch).some(probe.exists);
}
