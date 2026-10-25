import { ipcRenderer } from "electron";
import { BotGuardClient } from "bgutils-js/botguard";
import { WebPoMinter } from "bgutils-js/webpo";

const REFRESH_MARGIN_MS = 10 * 60 * 1000;
const DEFAULT_TTL_SECONDS = 6 * 60 * 60;

export interface BotguardChallenge {
  program: string;
  globalName: string;
  interpreterUrl?: string;
  interpreterScript?: string;
}

export interface IntegrityToken {
  token: string;
  ttlSeconds?: number;
}

export interface MinterEntry {
  minter: WebPoMinter;
  expiresAt: number;
}

interface RawChallenge {
  interpreterUrl?: {
    privateDoNotAccessOrElseTrustedResourceUrlWrappedValue?: string;
  };
  interpreterJavascript?: {
    privateDoNotAccessOrElseSafeScriptWrappedValue?: string;
  };
  program?: string;
  globalName?: string;
}

export function readChallenge(
  raw: RawChallenge | undefined,
): BotguardChallenge {
  const interpreterUrl =
    raw?.interpreterUrl?.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue;
  const interpreterScript =
    raw?.interpreterJavascript?.privateDoNotAccessOrElseSafeScriptWrappedValue;
  if (
    !raw?.program ||
    !raw.globalName ||
    !(interpreterUrl || interpreterScript)
  )
    throw new Error("BotGuard challenge is missing");
  return {
    program: raw.program,
    globalName: raw.globalName,
    ...(interpreterUrl ? { interpreterUrl } : {}),
    ...(interpreterScript ? { interpreterScript } : {}),
  };
}

async function loadInterpreter(challenge: BotguardChallenge): Promise<string> {
  if (challenge.interpreterScript) return challenge.interpreterScript;
  const url = challenge.interpreterUrl ?? "";
  return (await ipcRenderer.invoke(
    "potoken:interpreter",
    url.startsWith("//") ? `https:${url}` : url,
  )) as string;
}

export async function createMinter(
  challenge: BotguardChallenge,
  generateIntegrityToken: (botguardResponse: string) => Promise<IntegrityToken>,
): Promise<MinterEntry> {
  new Function(await loadInterpreter(challenge))();
  const botguard = await BotGuardClient.create({
    program: challenge.program,
    globalName: challenge.globalName,
    globalObject: globalThis,
  });
  const webPoSignalOutput: Parameters<typeof WebPoMinter.create>[1] = [];
  const botguardResponse = await botguard.snapshot({ webPoSignalOutput });
  const { token, ttlSeconds } = await generateIntegrityToken(botguardResponse);
  const minter = await WebPoMinter.create(
    { integrityToken: token.replace(/\+/g, "-").replace(/\//g, "_") },
    webPoSignalOutput,
  );
  const ttlMs =
    (ttlSeconds && ttlSeconds > 0 ? ttlSeconds : DEFAULT_TTL_SECONDS) * 1000;
  return {
    minter,
    expiresAt: Date.now() + Math.max(ttlMs - REFRESH_MARGIN_MS, 60_000),
  };
}

export function cachedMinter(create: () => Promise<MinterEntry>): {
  get: () => Promise<MinterEntry>;
  reset: () => void;
} {
  let current: MinterEntry | null = null;
  let pending: Promise<MinterEntry> | null = null;
  return {
    get: () => {
      if (current && Date.now() < current.expiresAt)
        return Promise.resolve(current);
      pending ??= create()
        .then((entry) => {
          current = entry;
          return entry;
        })
        .finally(() => {
          pending = null;
        });
      return pending;
    },
    reset: () => {
      current = null;
    },
  };
}
