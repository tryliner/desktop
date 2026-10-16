// true when the bytes start a complete audio file the <audio> element can open on its own.
// rejects fragmented-mp4 media segments ("styp"), error pages and other junk before caching.
export function isStandaloneAudioFile(head: Uint8Array): boolean {
  const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to));
  if (head.length < 12) return false;
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return true; // webm / matroska
  if (ascii(4, 8) === "ftyp") return true; // mp4 / m4a with its init header
  const magic = ascii(0, 4);
  if (magic === "OggS" || magic === "fLaC" || magic === "RIFF") return true;
  if (ascii(0, 3) === "ID3" || isMpegAudioFrame(head)) return true; // mp3
  return false;
}

// mpeg audio frame header: 11 sync bits, then version, layer, bitrate and sample rate fields that are not reserved
function isMpegAudioFrame(head: Uint8Array): boolean {
  if (head[0] !== 0xff || (head[1] & 0xe0) !== 0xe0) return false;
  const version = (head[1] >> 3) & 0x03;
  const layer = (head[1] >> 1) & 0x03;
  const bitrate = head[2] >> 4;
  const sampleRate = (head[2] >> 2) & 0x03;
  return version !== 0x01 && layer !== 0x00 && bitrate !== 0x0f && sampleRate !== 0x03;
}
