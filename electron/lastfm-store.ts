import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { SessionCipher } from "./auth-session-store";
import type {
  LastfmCredentials,
  LastfmListen,
} from "../src/features/lastfm/contracts";
import { validCredentials, validLastfmListen } from "./lastfm-api";

export interface LastfmData {
  credentials?: LastfmCredentials;
  session?: { username: string; key: string };
  username?: string;
  enabled: boolean;
  nowPlaying: boolean;
  queue: LastfmListen[];
  recent: string[];
}

export function emptyLastfmData(): LastfmData {
  return { enabled: false, nowPlaying: true, queue: [], recent: [] };
}

export class LastfmStore {
  constructor(
    private readonly directory: string,
    private readonly cipher: SessionCipher,
  ) {}

  private file(owner: string): string {
    return path.join(
      this.directory,
      createHash("sha256").update(owner).digest("hex") + ".bin",
    );
  }

  load(owner: string): LastfmData {
    const file = this.file(owner);
    if (!fs.existsSync(file)) return emptyLastfmData();
    const raw = JSON.parse(this.cipher.decrypt(fs.readFileSync(file)));
    if (
      !raw ||
      typeof raw !== "object" ||
      raw.version !== 1 ||
      !Array.isArray(raw.queue) ||
      !raw.queue.every(validLastfmListen) ||
      raw.queue.length > 10000 ||
      !Array.isArray(raw.recent) ||
      !raw.recent.every(
        (id: unknown) => typeof id === "string" && id.length <= 128,
      ) ||
      raw.recent.length > 1000 ||
      (raw.credentials !== undefined && !validCredentials(raw.credentials)) ||
      (raw.session !== undefined &&
        (!raw.session ||
          typeof raw.session.username !== "string" ||
          typeof raw.session.key !== "string" ||
          !raw.session.key)) ||
      (raw.username !== undefined && typeof raw.username !== "string") ||
      typeof raw.enabled !== "boolean" ||
      typeof raw.nowPlaying !== "boolean"
    ) {
      throw new Error("Invalid Last.fm storage.");
    }
    return raw as LastfmData;
  }

  save(owner: string, data: LastfmData): void {
    const file = this.file(owner);
    if (!this.cipher.available()) {
      // Remove old credentials on disconnect even if the keychain became unavailable.
      if (!data.session && data.queue.length === 0)
        fs.rmSync(file, { force: true });
      return;
    }
    fs.mkdirSync(this.directory, { recursive: true });
    const temp = `${file}.tmp`;
    const fd = fs.openSync(temp, "w", 0o600);
    try {
      fs.writeFileSync(
        fd,
        this.cipher.encrypt(JSON.stringify({ ...data, version: 1 })),
      );
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temp, file);
  }
}
