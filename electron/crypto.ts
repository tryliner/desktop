import crypto from "node:crypto";
import { SIGNER_WASM_BASE64 } from "./signer";

export interface SignRequestInput {
  method: string;
  path: string;
  body?: string | null;
}

export interface SignedRequestHeaders {
  signature: string;
  timestamp: number;
  nonce: string;
}

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

function getWasmExports(): WasmSignerExports {
  if (wasmExportsInstance) return wasmExportsInstance;

  const wasmBuffer = Buffer.from(SIGNER_WASM_BASE64, "base64");
  const wasmModule = new WebAssembly.Module(wasmBuffer);
  const wasmInstance = new WebAssembly.Instance(wasmModule, {});
  wasmExportsInstance = wasmInstance.exports as unknown as WasmSignerExports;
  return wasmExportsInstance;
}

function passStringToWasm(
  exports: WasmSignerExports,
  str: string,
): { ptr: number; len: number; free: () => void } {
  const bytes = Buffer.from(str, "utf8");
  const ptr = exports.liner_alloc(bytes.length);
  const memoryView = new Uint8Array(exports.memory.buffer, ptr, bytes.length);
  memoryView.set(bytes);
  return {
    ptr,
    len: bytes.length,
    free: () => exports.liner_dealloc(ptr, bytes.length),
  };
}

function readResultFromWasm(exports: WasmSignerExports): string {
  const ptr = exports.liner_get_result_ptr();
  const len = exports.liner_get_result_len();
  if (!ptr || len === 0) return "";
  const memoryView = new Uint8Array(exports.memory.buffer, ptr, len);
  return Buffer.from(memoryView).toString("utf8");
}

// signs cover url token via in-memory wasm
export function signCoverUrl(payload: string): string {
  const wasm = getWasmExports();
  const payloadBuf = passStringToWasm(wasm, payload);
  try {
    const code = wasm.liner_sign_cover_url(payloadBuf.ptr, payloadBuf.len);
    if (code !== 0) {
      throw new Error(`wasm sign_cover_url failed with code ${code}`);
    }
    return readResultFromWasm(wasm);
  } finally {
    payloadBuf.free();
  }
}

// signs api request with canonical string and hmac-sha256
export function signRequest(input: SignRequestInput): SignedRequestHeaders {
  const wasm = getWasmExports();
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(8).toString("hex");

  const methodBuf = passStringToWasm(wasm, input.method);
  const pathBuf = passStringToWasm(wasm, input.path);
  const bodyBuf = passStringToWasm(wasm, input.body ?? "");
  const nonceBuf = passStringToWasm(wasm, nonce);

  try {
    const code = wasm.liner_sign_request(
      methodBuf.ptr,
      methodBuf.len,
      pathBuf.ptr,
      pathBuf.len,
      bodyBuf.ptr,
      bodyBuf.len,
      BigInt(timestamp),
      nonceBuf.ptr,
      nonceBuf.len,
    );

    if (code !== 0) {
      throw new Error(`wasm sign_request failed with code ${code}`);
    }

    const signature = readResultFromWasm(wasm);
    return {
      signature,
      timestamp,
      nonce,
    };
  } finally {
    methodBuf.free();
    pathBuf.free();
    bodyBuf.free();
    nonceBuf.free();
  }
}

// signs monitor telemetry request
export function signMonitorRequest(input: SignRequestInput): SignedRequestHeaders {
  const wasm = getWasmExports();
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(8).toString("hex");

  const methodBuf = passStringToWasm(wasm, input.method);
  const pathBuf = passStringToWasm(wasm, input.path);
  const bodyBuf = passStringToWasm(wasm, input.body ?? "");
  const nonceBuf = passStringToWasm(wasm, nonce);

  try {
    const code = wasm.liner_sign_monitor_request(
      methodBuf.ptr,
      methodBuf.len,
      pathBuf.ptr,
      pathBuf.len,
      bodyBuf.ptr,
      bodyBuf.len,
      BigInt(timestamp),
      nonceBuf.ptr,
      nonceBuf.len,
    );

    if (code !== 0) {
      throw new Error(`wasm sign_monitor_request failed with code ${code}`);
    }

    const signature = readResultFromWasm(wasm);
    return {
      signature,
      timestamp,
      nonce,
    };
  } finally {
    methodBuf.free();
    pathBuf.free();
    bodyBuf.free();
    nonceBuf.free();
  }
}

// signs raw byte buffer
export function signRawPayload(payload: Buffer | Uint8Array): string {
  const wasm = getWasmExports();
  const bytes = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const ptr = wasm.liner_alloc(bytes.length);
  const memoryView = new Uint8Array(wasm.memory.buffer, ptr, bytes.length);
  memoryView.set(bytes);
  try {
    const code = wasm.liner_sign_raw_payload(ptr, bytes.length);
    if (code !== 0) {
      throw new Error(`wasm sign_raw_payload failed with code ${code}`);
    }
    return readResultFromWasm(wasm);
  } finally {
    wasm.liner_dealloc(ptr, bytes.length);
  }
}


