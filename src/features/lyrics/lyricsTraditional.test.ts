import { beforeAll, describe, expect, it } from "vitest";
import { loadRomanizers, romanizeLine } from "./engine/lyricsRomanization";

beforeAll(async () => {
  await loadRomanizers([{ startTimeMs: 0, durationMs: 1000, words: "我爱你" }]);
});

describe("traditional chinese characters", () => {
  it("reads common neutral-tone words the same as simplified", () => {
    expect(romanizeLine("什麼")).toBe(romanizeLine("什么"));
    expect(romanizeLine("什麼")).toBe("shén me");
    expect(romanizeLine("你愛我嗎")).toBe("nǐ ài wǒ ma");
    expect(romanizeLine("我們")).toBe("wǒ men");
  });

  it("picks the right reading for common traditional words", () => {
    expect(romanizeLine("時間")).toBe("shí jiān");
    expect(romanizeLine("長大")).toBe("zhǎng dà");
    expect(romanizeLine("音樂")).toBe("yīn yuè");
    expect(romanizeLine("因為你")).toBe("yīn wèi nǐ");
    expect(romanizeLine("還是你")).toBe("hái shì nǐ");
    expect(romanizeLine("為你")).toBe("wèi nǐ");
  });

  it("handles traditional polyphonic place and bank names", () => {
    expect(romanizeLine("重慶很重要")).toBe("chóng qìng hěn zhòng yào");
    expect(romanizeLine("銀行行長")).toBe("yín háng háng zhǎng");
  });

  it("keeps latin words in a traditional line", () => {
    expect(romanizeLine("因為你讓我看見forever")).toBe(
      "yīn wèi nǐ ràng wǒ kàn jiàn forever",
    );
  });
});
