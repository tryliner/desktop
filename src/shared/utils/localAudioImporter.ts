import { linerDb } from "@/shared/storage/linerDb";
import type { Track } from "@/shared/types";

export interface ParsedAudioMetadata {
  title: string;
  artists: string;
  album?: string;
  coverUrl?: string;
}

/**
 * Lightweight pure-TS ID3v2 parser for extracting Title, Artist, Album, and Cover Art.
 */
export function parseId3Metadata(buffer: ArrayBuffer): ParsedAudioMetadata | null {
  try {
    const view = new DataView(buffer);
    if (buffer.byteLength < 10) return null;

    // Check "ID3" header
    if (
      view.getUint8(0) !== 0x49 ||
      view.getUint8(1) !== 0x44 ||
      view.getUint8(2) !== 0x33
    ) {
      return null;
    }

    const version = view.getUint8(3); // 3 for ID3v2.3, 4 for ID3v2.4
    if (version !== 3 && version !== 4) return null;

    // Tag size (synchsafe integer: 4 bytes of 7 bits each)
    const tagSize =
      ((view.getUint8(6) & 0x7f) << 21) |
      ((view.getUint8(7) & 0x7f) << 14) |
      ((view.getUint8(8) & 0x7f) << 7) |
      (view.getUint8(9) & 0x7f);

    const endOffset = Math.min(10 + tagSize, buffer.byteLength);
    let offset = 10;

    let title = "";
    let artists = "";
    let album = "";
    let coverUrl = "";

    const textDecoderUtf8 = new TextDecoder("utf-8");
    const textDecoderLatin1 = new TextDecoder("iso-8859-1");

    function decodeText(bytes: Uint8Array, encodingByte: number): string {
      try {
        if (encodingByte === 3 || encodingByte === 0) {
          // 0 is latin1, 3 is utf-8
          const decoder = encodingByte === 3 ? textDecoderUtf8 : textDecoderLatin1;
          return decoder.decode(bytes).replace(/\0+$/, "").trim();
        } else if (encodingByte === 1 || encodingByte === 2) {
          // UTF-16
          const decoder = new TextDecoder(encodingByte === 1 ? "utf-16" : "utf-16be");
          return decoder.decode(bytes).replace(/\0+$/, "").trim();
        }
        return textDecoderLatin1.decode(bytes).replace(/\0+$/, "").trim();
      } catch {
        return "";
      }
    }

    function bytesToBase64(bytes: Uint8Array): string {
      if (typeof Buffer !== "undefined") {
        return Buffer.from(bytes).toString("base64");
      }
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
      }
      return btoa(binary);
    }

    while (offset + 10 < endOffset) {
      // 4-char frame ID
      const frameId = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3),
      );

      // Frame ID must be 4 uppercase alphanumeric characters
      if (!/^[A-Z0-9]{4}$/.test(frameId)) {
        break;
      }

      // Frame size
      let frameSize = 0;
      if (version === 4) {
        // ID3v2.4 uses synchsafe integers for frame sizes
        frameSize =
          ((view.getUint8(offset + 4) & 0x7f) << 21) |
          ((view.getUint8(offset + 5) & 0x7f) << 14) |
          ((view.getUint8(offset + 6) & 0x7f) << 7) |
          (view.getUint8(offset + 7) & 0x7f);
      } else {
        frameSize = view.getUint32(offset + 4, false);
      }

      offset += 10; // Skip frame header

      if (frameSize <= 0 || offset + frameSize > endOffset) {
        break;
      }

      const frameData = new Uint8Array(buffer, offset, frameSize);

      if (frameId === "TIT2" && frameSize > 1) {
        title = decodeText(frameData.subarray(1), frameData[0]);
      } else if (frameId === "TPE1" && frameSize > 1) {
        artists = decodeText(frameData.subarray(1), frameData[0]);
      } else if (frameId === "TALB" && frameSize > 1) {
        album = decodeText(frameData.subarray(1), frameData[0]);
      } else if (frameId === "APIC" && frameSize > 10 && !coverUrl) {
        try {
          const enc = frameData[0];
          let cur = 1;
          // Find mime type (null terminated ASCII)
          let mime = "";
          while (cur < frameSize && frameData[cur] !== 0) {
            mime += String.fromCharCode(frameData[cur]);
            cur++;
          }
          cur++; // skip null
          if (!mime) mime = "image/jpeg";

          // skip picture type (1 byte)
          cur++;

          // skip description (null terminated according to encoding)
          if (enc === 1 || enc === 2) {
            while (cur + 1 < frameSize && !(frameData[cur] === 0 && frameData[cur + 1] === 0)) {
              cur += 2;
            }
            cur += 2;
          } else {
            while (cur < frameSize && frameData[cur] !== 0) {
              cur++;
            }
            cur++;
          }

          if (cur < frameSize) {
            const imgBytes = frameData.subarray(cur);
            const base64 = bytesToBase64(imgBytes);
            coverUrl = `data:${mime};base64,${base64}`;
          }
        } catch {
          // ignore APIC parse failure
        }
      }

      offset += frameSize;
    }

    if (title || artists) {
      return { title, artists, album, coverUrl };
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Extracts a readable Title and Artist from a filename when ID3 metadata is not available.
 * E.g. "Daft Punk - One More Time.mp3" -> { artists: "Daft Punk", title: "One More Time" }
 */
export function parseFilenameMetadata(filename: string): { title: string; artists: string } {
  const baseName = filename.replace(/\.[a-zA-Z0-9]+$/, "").trim();

  // Try pattern: "Artist - Title"
  const dashIndex = baseName.indexOf(" - ");
  if (dashIndex > 0) {
    const artists = baseName.slice(0, dashIndex).trim();
    const title = baseName.slice(dashIndex + 3).trim();
    if (artists && title) {
      return { artists, title };
    }
  }

  // Try pattern: "01. Title" or "01 - Title"
  const numberCleaned = baseName.replace(/^\d+[\.\-\s]+/, "").trim();

  return {
    title: numberCleaned || baseName || "Local Audio",
    artists: "Local File",
  };
}

/**
 * Calculates audio duration in milliseconds via HTMLAudioElement.
 */
export function getAudioDurationMs(file: File | Blob): Promise<number> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof Audio === "undefined") {
      resolve(0);
      return;
    }

    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";

    const cleanup = () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("error", onError);
      URL.revokeObjectURL(url);
    };

    const onLoaded = () => {
      const durationMs = Math.round((audio.duration || 0) * 1000);
      cleanup();
      resolve(Number.isFinite(durationMs) ? durationMs : 0);
    };

    const onError = () => {
      cleanup();
      resolve(0);
    };

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("error", onError);
    audio.src = url;

    // Timeout safety fallback (2.5 seconds)
    setTimeout(() => {
      cleanup();
      resolve(0);
    }, 2500);
  });
}

const SUPPORTED_AUDIO_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "flac",
  "m4a",
  "ogg",
  "opus",
  "aac",
  "webm",
]);

export function isAudioFile(file: File): boolean {
  if (file.type && file.type.startsWith("audio/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return SUPPORTED_AUDIO_EXTENSIONS.has(ext);
}

/**
 * Imports audio files into Liner's local cache (IndexedDB).
 */
export async function importAudioFilesToCache(files: File[] | FileList): Promise<Track[]> {
  const fileList = Array.from(files).filter(isAudioFile);
  if (fileList.length === 0) return [];

  const importedTracks: Track[] = [];

  for (const file of fileList) {
    try {
      const buffer = await file.arrayBuffer();
      const id3 = parseId3Metadata(buffer);
      const fallback = parseFilenameMetadata(file.name);

      const title = id3?.title || fallback.title;
      const artists = id3?.artists || fallback.artists;
      const albumTitle = id3?.album || undefined;
      const coverUrl = id3?.coverUrl || "";

      const durationMs = await getAudioDurationMs(file);
      const trackId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const track: Track = {
        id: trackId,
        title,
        artists,
        album: albumTitle ? { id: "", title: albumTitle } : undefined,
        coverUrl,
        durationMs,
        playCount: 0,
      };

      await linerDb.putAudio(trackId, file, file.type || "audio/mpeg");
      await linerDb.putTrack(track);

      importedTracks.push(track);
    } catch (err) {
      console.error(`[LocalAudioImporter] Failed to import file ${file.name}:`, err);
    }
  }

  if (importedTracks.length > 0 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("liner:cache_changed"));
  }

  return importedTracks;
}
