import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseFilenameMetadata,
  isAudioFile,
  parseId3Metadata,
  importAudioFilesToCache,
} from "./localAudioImporter";
import { linerDb } from "@/shared/storage/linerDb";

describe("localAudioImporter", () => {
  describe("parseFilenameMetadata", () => {
    it("parses 'Artist - Title' format properly", () => {
      const res = parseFilenameMetadata("Daft Punk - One More Time.mp3");
      expect(res.artists).toBe("Daft Punk");
      expect(res.title).toBe("One More Time");
    });

    it("handles tracks with leading track numbers", () => {
      const res = parseFilenameMetadata("01. Harder, Better, Faster, Stronger.flac");
      expect(res.title).toBe("Harder, Better, Faster, Stronger");
      expect(res.artists).toBe("Local File");
    });

    it("falls back to base name when no delimiter is present", () => {
      const res = parseFilenameMetadata("TrackWithoutArtist.wav");
      expect(res.title).toBe("TrackWithoutArtist");
      expect(res.artists).toBe("Local File");
    });
  });

  describe("isAudioFile", () => {
    it("identifies audio files by mime type", () => {
      const file = new File(["dummy"], "audio.bin", { type: "audio/mpeg" });
      expect(isAudioFile(file)).toBe(true);
    });

    it("identifies audio files by extension", () => {
      const extensions = ["mp3", "wav", "flac", "m4a", "ogg", "opus", "aac", "webm"];
      for (const ext of extensions) {
        const file = new File(["dummy"], `test.${ext}`, { type: "" });
        expect(isAudioFile(file)).toBe(true);
      }
    });

    it("rejects non-audio files", () => {
      const file = new File(["dummy"], "document.pdf", { type: "application/pdf" });
      expect(isAudioFile(file)).toBe(false);

      const img = new File(["dummy"], "picture.png", { type: "image/png" });
      expect(isAudioFile(img)).toBe(false);
    });
  });

  describe("parseId3Metadata", () => {
    it("returns null for non-ID3 buffers", () => {
      const buffer = new ArrayBuffer(20);
      expect(parseId3Metadata(buffer)).toBe(null);
    });

    it("correctly parses ID3v2.3 TIT2 and TPE1 frames", () => {
      // Build a minimal ID3v2.3 tag in memory:
      // Header: 'ID3' (3 bytes), version 3 (1 byte), revision 0 (1 byte), flags 0 (1 byte), synchsafe size (4 bytes)
      // Frame TIT2: 'TIT2' (4 bytes), size 7 (4 bytes), flags 0 (2 bytes), encoding 0 (latin1), "Test" (4 bytes)
      const titleText = "Song Title";
      const artistText = "Artist Name";

      const enc = new TextEncoder();
      const titleBytes = enc.encode(titleText);
      const artistBytes = enc.encode(artistText);

      // TIT2 frame: 10 byte header + 1 encoding byte + titleBytes.length
      const tit2Size = 1 + titleBytes.length;
      // TPE1 frame: 10 byte header + 1 encoding byte + artistBytes.length
      const tpe1Size = 1 + artistBytes.length;

      const tagSize = 10 + tit2Size + 10 + tpe1Size;
      const buffer = new ArrayBuffer(10 + tagSize);
      const view = new DataView(buffer);
      const bytes = new Uint8Array(buffer);

      // 'ID3'
      bytes[0] = 0x49;
      bytes[1] = 0x44;
      bytes[2] = 0x33;
      bytes[3] = 3; // v2.3
      bytes[4] = 0; // rev
      bytes[5] = 0; // flags
      // synchsafe size
      bytes[6] = (tagSize >> 21) & 0x7f;
      bytes[7] = (tagSize >> 14) & 0x7f;
      bytes[8] = (tagSize >> 7) & 0x7f;
      bytes[9] = tagSize & 0x7f;

      let pos = 10;
      // TIT2
      bytes.set(enc.encode("TIT2"), pos);
      view.setUint32(pos + 4, tit2Size, false);
      bytes[pos + 10] = 3; // utf-8 encoding
      bytes.set(titleBytes, pos + 11);

      pos += 10 + tit2Size;
      // TPE1
      bytes.set(enc.encode("TPE1"), pos);
      view.setUint32(pos + 4, tpe1Size, false);
      bytes[pos + 10] = 3; // utf-8 encoding
      bytes.set(artistBytes, pos + 11);

      const metadata = parseId3Metadata(buffer);
      expect(metadata).not.toBeNull();
      expect(metadata?.title).toBe(titleText);
      expect(metadata?.artists).toBe(artistText);
    });
  });

  describe("importAudioFilesToCache", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("imports audio files into linerDb and dispatches liner:cache_changed", async () => {
      const putAudioSpy = vi.spyOn(linerDb, "putAudio").mockResolvedValue();
      const putTrackSpy = vi.spyOn(linerDb, "putTrack").mockResolvedValue();

      let eventFired = false;
      const listener = () => {
        eventFired = true;
      };
      window.addEventListener("liner:cache_changed", listener);

      const mockFile = new File([new ArrayBuffer(100)], "Test Artist - Great Song.mp3", {
        type: "audio/mpeg",
      });

      const imported = await importAudioFilesToCache([mockFile]);

      window.removeEventListener("liner:cache_changed", listener);

      expect(imported.length).toBe(1);
      expect(imported[0].title).toBe("Great Song");
      expect(imported[0].artists).toBe("Test Artist");
      expect(imported[0].id.startsWith("local_")).toBe(true);

      expect(putAudioSpy).toHaveBeenCalledWith(
        imported[0].id,
        mockFile,
        "audio/mpeg",
      );
      expect(putTrackSpy).toHaveBeenCalledWith(imported[0]);
      expect(eventFired).toBe(true);
    });

    it("skips non-audio files", async () => {
      const putAudioSpy = vi.spyOn(linerDb, "putAudio").mockResolvedValue();
      const nonAudioFile = new File(["dummy"], "readme.txt", { type: "text/plain" });

      const imported = await importAudioFilesToCache([nonAudioFile]);
      expect(imported.length).toBe(0);
      expect(putAudioSpy).not.toHaveBeenCalled();
    });
  });
});
