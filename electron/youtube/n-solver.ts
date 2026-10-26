import { parseScript, type ESTree } from "meriyah";
import { findUrlFactory, type UrlFactory } from "./n-factory";

const PLAYER_VARIANTS = [
  "tv-player-ias-tcl.vflset/tv-player-ias-tcl.js",
  "tv-player-ias.vflset/tv-player-ias.js",
];
const SKIPPED_METHODS = new Set(["constructor", "set", "get", "clone"]);
const PROBE_URL = "https://youtube.com/watch?v=liner";

interface PlayerUrl {
  set: (key: string, value: string) => void;
  get: (key: string) => unknown;
}

type UrlFactoryFn = (...args: Array<number | string>) => PlayerUrl;

interface LoadedPlayer {
  signatureTimestamp: number;
  factory: UrlFactory;
  create: UrlFactoryFn;
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
  const exportName = `__linerUrlFactory_${playerId.replace(/\W/g, "_")}`;
  const end = (body.range?.[1] ?? source.length) - 1;
  const instrumented = `${source.slice(0, end)};globalThis.${exportName}=${factory.name};${source.slice(end)}`;
  new Function(instrumented).call(globalThis);
  const create: unknown = Reflect.get(globalThis, exportName);
  if (typeof create !== "function")
    throw new Error("YouTube TV player url factory is not callable");
  return { signatureTimestamp, factory, create: create as UrlFactoryFn };
}

function transformN(player: LoadedPlayer, value: string): string {
  const url = player.create(...player.factory.args, PROBE_URL);
  url.set("n", value);
  const proto: object = Object.getPrototypeOf(url);
  const keys = [...Object.keys(proto), ...Object.getOwnPropertyNames(proto)];
  const method = keys.find(
    (key) =>
      !SKIPPED_METHODS.has(key) && typeof Reflect.get(url, key) === "function",
  );
  const transform: unknown = method ? Reflect.get(url, method) : undefined;
  if (typeof transform !== "function")
    throw new Error("YouTube TV player url has no transform");
  Reflect.apply(transform, url, []);
  const result = String(url.get("n") ?? "");
  if (!result || result === value || !/^[\w-]+$/.test(result))
    throw new Error("YouTube TV player returned an invalid n value");
  return result;
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
  return {
    signatureTimestamp: player.signatureTimestamp,
    values: values.map((value) => transformN(player, value)),
  };
}
