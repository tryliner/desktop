import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface MacUpdateCapability {
  supported: boolean;
  reason?: string;
  teamIdentifier?: string;
}

interface CodesignResult {
  status: number | null;
  output: string;
  error?: Error;
}

type CodesignRunner = (args: string[]) => Promise<CodesignResult>;

async function runCodesign(args: string[]): Promise<CodesignResult> {
  try {
    const result = await execFileAsync("/usr/bin/codesign", args, {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return {
      status: 0,
      output: `${result.stdout}\n${result.stderr}`,
    };
  } catch (error) {
    const commandError = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
    };
    return {
      status: typeof commandError.code === "number" ? commandError.code : null,
      output: `${commandError.stdout ?? ""}\n${commandError.stderr ?? ""}`,
      error:
        typeof commandError.code === "number" ? undefined : (error as Error),
    };
  }
}

export function findMacAppBundle(executablePath: string): string | null {
  let currentPath = path.resolve(executablePath);

  while (true) {
    if (currentPath.endsWith(".app")) return currentPath;

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) return null;
    currentPath = parentPath;
  }
}

export async function inspectMacAppBundle(
  bundlePath: string,
  run: CodesignRunner = runCodesign,
): Promise<MacUpdateCapability> {
  const verification = await run([
    "--verify",
    "--deep",
    "--strict",
    "--verbose=2",
    bundlePath,
  ]);

  if (verification.error || verification.status !== 0) {
    return {
      supported: false,
      reason: "The installed macOS app failed strict code-signature verification.",
    };
  }

  const details = await run(["-dv", "--verbose=4", bundlePath]);
  if (details.error || details.status !== 0) {
    return {
      supported: false,
      reason: "The installed macOS app signature could not be inspected.",
    };
  }

  const lines = details.output.split(/\r?\n/);
  const teamIdentifier = lines
    .find((line) => line.startsWith("TeamIdentifier="))
    ?.slice("TeamIdentifier=".length);
  const authorities = lines
    .filter((line) => line.startsWith("Authority="))
    .map((line) => line.slice("Authority=".length));
  const developerIdAuthority = authorities.find((authority) =>
    authority.startsWith("Developer ID Application:"),
  );
  const authorityTeamId = developerIdAuthority
    ?.match(/\(([A-Z0-9]{10})\)$/)?.[1];

  if (
    !teamIdentifier ||
    !/^[A-Z0-9]{10}$/.test(teamIdentifier) ||
    !authorityTeamId ||
    authorityTeamId !== teamIdentifier
  ) {
    return {
      supported: false,
      reason:
        "The installed macOS app does not have a matching Developer ID Application authority and Team Identifier.",
    };
  }

  return { supported: true, teamIdentifier };
}

export async function getMacUpdateCapability(options: {
  platform: string;
  isPackaged: boolean;
  executablePath: string;
  inspect?: (
    bundlePath: string,
  ) => MacUpdateCapability | Promise<MacUpdateCapability>;
}): Promise<MacUpdateCapability> {
  if (options.platform !== "darwin") return { supported: true };
  if (!options.isPackaged) {
    return { supported: false, reason: "The app is not packaged." };
  }

  const bundlePath = findMacAppBundle(options.executablePath);
  if (!bundlePath) {
    return {
      supported: false,
      reason: "The installed macOS app bundle could not be located.",
    };
  }

  return (options.inspect ?? inspectMacAppBundle)(bundlePath);
}
