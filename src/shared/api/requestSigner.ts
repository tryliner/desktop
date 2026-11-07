import { SIGNER_WASM_BASE64 } from "../../../electron/signer";

// signs outgoing api requests with canonical headers: x-liner-signature, timestamp, nonce
export interface SignedHeaders {
  "x-liner-signature"?: string;
  "x-liner-timestamp"?: string;
  "x-liner-nonce"?: string;
}

// maintains clock delta between client and server (ms)
let serverTimeOffsetMs = 0;

// parses date header from server response and calculates clock delta
export function syncServerTime(dateHeaderOrMs: string | number | Date): number {
  const serverMs =
    typeof dateHeaderOrMs === "number"
      ? dateHeaderOrMs
      : typeof dateHeaderOrMs === "string"
        ? Date.parse(dateHeaderOrMs)
        : dateHeaderOrMs.getTime();

  if (!Number.isNaN(serverMs) && serverMs > 0) {
    serverTimeOffsetMs = serverMs - Date.now();
    // notify electron main process to sync its native signer clock
    if (typeof window !== "undefined" && window.linerElectron?.syncServerTime) {
      window.linerElectron.syncServerTime(serverMs).catch(() => {});
    }
  }
  return serverTimeOffsetMs;
}

export function getServerTimeOffset(): number {
  return serverTimeOffsetMs;
}

export function getAdjustedTimestamp(): number {
  return Math.floor((Date.now() + serverTimeOffsetMs) / 1000);
}

function isElectron(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.linerElectron?.signRequest === "function"
  );
}

// ---- In-Browser / Mobile WebAssembly Signer ----
interface WasmSignerExports {
  liner_alloc: (len: number) => number;
  liner_dealloc: (ptr: number, len: number) => void;
  liner_get_result_ptr: () => number;
  liner_get_result_len: () => number;
  liner_sign_cover_url: (ptr: number, len: number) => number;
  liner_sign_request: (
    method_ptr: number,
    method_len: number,
    path_ptr: number,
    path_len: number,
    body_ptr: number,
    body_len: number,
    timestamp: bigint,
    nonce_ptr: number,
    nonce_len: number,
  ) => number;
  liner_sign_monitor_request: (
    method_ptr: number,
    method_len: number,
    path_ptr: number,
    path_len: number,
    body_ptr: number,
    body_len: number,
    timestamp: bigint,
    nonce_ptr: number,
    nonce_len: number,
  ) => number;
  liner_sign_raw_payload: (ptr: number, len: number) => number;
  memory: WebAssembly.Memory;
}

let wasmExportsInstance: WasmSignerExports | null = null;

function getWasmExports(): WasmSignerExports | null {
  if (wasmExportsInstance) return wasmExportsInstance;
  try {
    const binary = atob(SIGNER_WASM_BASE64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const wasmModule = new WebAssembly.Module(bytes);
    const wasmInstance = new WebAssembly.Instance(wasmModule, {});
    wasmExportsInstance = wasmInstance.exports as unknown as WasmSignerExports;
    return wasmExportsInstance;
  } catch (err) {
    console.error("[Signer] Failed to initialize in-browser WASM signer:", err);
    return null;
  }
}

function passStringToWasm(
  exports: WasmSignerExports,
  str: string,
): { ptr: number; len: number; free: () => void } {
  const enc = new TextEncoder().encode(str);
  const ptr = exports.liner_alloc(enc.length);
  const mem = new Uint8Array(exports.memory.buffer, ptr, enc.length);
  mem.set(enc);
  return {
    ptr,
    len: enc.length,
    free: () => exports.liner_dealloc(ptr, enc.length),
  };
}

function readResultFromWasm(exports: WasmSignerExports): string {
  const ptr = exports.liner_get_result_ptr();
  const len = exports.liner_get_result_len();
  if (!ptr || len === 0) return "";
  const mem = new Uint8Array(exports.memory.buffer, ptr, len);
  return new TextDecoder().decode(mem);
}

function generateRandomHex(byteCount = 8): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const arr = new Uint8Array(byteCount);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  let s = "";
  for (let i = 0; i < byteCount * 2; i++) {
    s += Math.floor(Math.random() * 16).toString(16);
  }
  return s;
}

function signInBrowserWasm(
  method: string,
  path: string,
  body?: string | null,
  timestamp?: number,
): SignedHeaders {
  const wasm = getWasmExports();
  if (!wasm) return {};

  const ts = timestamp ?? getAdjustedTimestamp();
  const nonce = generateRandomHex(8);

  const methodBuf = passStringToWasm(wasm, method.toUpperCase().trim());
  const pathBuf = passStringToWasm(wasm, path);
  const bodyBuf = passStringToWasm(wasm, body ?? "");
  const nonceBuf = passStringToWasm(wasm, nonce);

  try {
    const code = wasm.liner_sign_request(
      methodBuf.ptr,
      methodBuf.len,
      pathBuf.ptr,
      pathBuf.len,
      bodyBuf.ptr,
      bodyBuf.len,
      BigInt(ts),
      nonceBuf.ptr,
      nonceBuf.len,
    );

    if (code !== 0) {
      console.error(`[Signer] WASM sign_request failed with code ${code}`);
      return {};
    }

    const signature = readResultFromWasm(wasm);
    return {
      "x-liner-signature": signature,
      "x-liner-timestamp": String(ts),
      "x-liner-nonce": nonce,
    };
  } finally {
    methodBuf.free();
    pathBuf.free();
    bodyBuf.free();
    nonceBuf.free();
  }
}

export async function signApiRequest(
  method: string,
  path: string,
  body?: string | null,
  customTimestamp?: number,
): Promise<SignedHeaders> {
  const cleanPath = path.split("?")[0].trim();
  const timestamp = customTimestamp ?? getAdjustedTimestamp();

  if (isElectron()) {
    try {
      const res = await window.linerElectron!.signRequest({
        method: method.toUpperCase().trim(),
        path: cleanPath,
        body: body ?? undefined,
        timestamp,
      });

      if (res && res.error) {
        console.error("[Signer] Native signer error, falling back to WASM:", res.error);
        return signInBrowserWasm(method, cleanPath, body, timestamp);
      } else if (res && res.signature) {
        return {
          "x-liner-signature": res.signature,
          "x-liner-timestamp": String(res.timestamp ?? timestamp),
          "x-liner-nonce": res.nonce,
        };
      }
    } catch (err) {
      console.error("[Signer] IPC signRequest call failed, falling back to WASM:", err);
      return signInBrowserWasm(method, cleanPath, body, timestamp);
    }
  }

  // Running in browser, mobile web, or Capacitor native without Electron
  return signInBrowserWasm(method, cleanPath, body, timestamp);
}
