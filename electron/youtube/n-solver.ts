import { contextBridge } from "electron";
import { parseScript, type ESTree } from "meriyah";
import { findUrlFactory, type UrlFactory } from "./n-factory";

const PLAYER_VARIANTS = [
  "tv-player-ias-tcl.vflset/tv-player-ias-tcl.js",
  "tv-player-ias.vflset/tv-player-ias.js",
];

interface PlayerUrl {
  set: (key: string, value: string) => void;
  get: (key: string) => unknown;
}

type UrlFactoryFn = (...args: Array<number | string>) => PlayerUrl;

interface LoadedPlayer {
  signatureTimestamp: number;
  factory: UrlFactory;
  exportName: string;
}

export interface SolveResult {
  signatureTimestamp: number;
  values: string[];
}

const players = new Map<string, Promise<LoadedPlayer>>();

async function fetchPlayer(playerId: string): Promise<string> {
  for (const variant of PLAYER_VARIANTS) {
    const response = await fetch(`/s/player/${playerId}/${variant}`);
    if (response.ok) return response.text();
  }
  throw new Error(`YouTube TV player ${playerId} is unavailable`);
}

function wrapperBody(program: ESTree.Program): ESTree.BlockStatement {
  for (const statement of program.body) {
    if (statement.type !== "ExpressionStatement") continue;
    const call = statement.expression;
    if (call.type !== "CallExpression") continue;
    const callee =
      call.callee.type === "MemberExpression"
        ? call.callee.object
        : call.callee;
    if (callee.type === "FunctionExpression" && callee.body) return callee.body;
  }
  throw new Error("YouTube TV player has an unexpected layout");
}

// serialized into the page's main world, so it must not use anything outside its own body
function runPlayer(
  exportName: string,
  args: number[],
  values: string[],
  source?: string,
): string[] {
  const SKIPPED_METHODS = new Set(["constructor", "set", "get", "clone"]);
  const PROBE_URL = "https://youtube.com/watch?v=liner";
  if (source) new Function(source).call(globalThis);
  const create: unknown = Reflect.get(globalThis, exportName);
  if (typeof create !== "function")
    throw new Error("YouTube TV player url factory is not callable");
  return values.map((value) => {
    const url = (create as UrlFactoryFn)(...args, PROBE_URL);
    url.set("n", value);
    const proto: object = Object.getPrototypeOf(url);
    const keys = [...Object.keys(proto), ...Object.getOwnPropertyNames(proto)];
    const method = keys.find(
      (key) =>
        !SKIPPED_METHODS.has(key) &&
        typeof Reflect.get(url, key) === "function",
    );
    const transform: unknown = method ? Reflect.get(url, method) : undefined;
    if (typeof transform !== "function")
      throw new Error("YouTube TV player url has no transform");
    Reflect.apply(transform, url, []);
    return String(url.get("n") ?? "");
  });
}

// the player script runs in the page's main world, out of reach of ipcRenderer
function inMainWorld(
  player: LoadedPlayer,
  values: string[],
  source?: string,
): unknown {
  return contextBridge.executeInMainWorld({
    func: runPlayer,
    args: [player.exportName, player.factory.args, values, source],
  });
}

async function loadPlayer(playerId: string): Promise<LoadedPlayer> {
  const source = await fetchPlayer(playerId);
  const signatureTimestamp = Number(
    /signatureTimestamp:(\d+)/.exec(source)?.[1],
  );
  if (!Number.isFinite(signatureTimestamp))
    throw new Error("YouTube TV player has no signature timestamp");
  const body = wrapperBody(parseScript(source, { ranges: true }));
  const factory = findUrlFactory(body.body);
  if (!factory) throw new Error("YouTube TV player url factory not found");
  // raw id as a quoted key: replacing \W would give a-b and a_b the same global
  const exportName = `__linerUrlFactory_${playerId}`;
  const end = (body.range?.[1] ?? source.length) - 1;
  const instrumented = `${source.slice(0, end)};globalThis[${JSON.stringify(exportName)}]=${factory.name};${source.slice(end)}`;
  const player = { signatureTimestamp, factory, exportName };
  inMainWorld(player, [], instrumented);
  return player;
}

export async function solveN(
  playerId: string,
  values: string[],
): Promise<SolveResult> {
  let loading = players.get(playerId);
  if (!loading) {
    loading = loadPlayer(playerId);
    players.set(playerId, loading);
    loading.catch(() => players.delete(playerId));
  }
  const player = await loading;
  const results = inMainWorld(player, values);
  return {
    signatureTimestamp: player.signatureTimestamp,
    values: values.map((value, index) => {
      const result: unknown = Array.isArray(results) ? results[index] : null;
      if (
        typeof result !== "string" ||
        result === value ||
        !/^[\w-]+$/.test(result)
      )
        throw new Error("YouTube TV player returned an invalid n value");
      return result;
    }),
  };
}
