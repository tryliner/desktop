// signs outgoing api requests with canonical headers: x-liner-signature, timestamp, nonce
export interface SignedHeaders {
  "x-liner-signature"?: string;
  "x-liner-timestamp"?: string;
  "x-liner-nonce"?: string;
}

interface SignedRequestHeadersResult {
  signature: string;
  timestamp: number;
  nonce: string;
}

function isElectron(): boolean {
  return typeof window !== "undefined" && typeof window.linerElectron?.signRequest === "function";
}

export async function signApiRequest(
  method: string,
  path: string,
  body?: string | null,
): Promise<SignedHeaders> {
  if (!isElectron()) {
    if (import.meta.env.DEV) {
      console.warn(
        "[Signer] Not running in Electron environment (window.linerElectron is undefined). Outgoing requests will NOT have HMAC headers.",
      );
    }
    return {};
  }

  const cleanPath = path.split("?")[0].trim();

  try {
    const res = await window.linerElectron!.signRequest({
      method: method.toUpperCase().trim(),
      path: cleanPath,
      body: body ?? undefined,
    });

    if (res && res.error) {
      console.error("[Signer] Native signer error:", res.error);
    } else if (res && res.signature) {
      return {
        "x-liner-signature": res.signature,
        "x-liner-timestamp": String(res.timestamp),
        "x-liner-nonce": res.nonce,
      };
    }
  } catch (err) {
    console.error("[Signer] IPC signRequest call failed:", err);
  }

  return {};
}
