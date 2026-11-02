import { describe, it, expect, vi, beforeEach } from "vitest";
import { translateWithOllama, romanizeWithOllama } from "./ollamaProvider";

describe("ollamaProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls local Ollama endpoint without requiring an API key", async () => {
    let capturedUrl = "";
    global.fetch = vi.fn<typeof fetch>(async (input) => {
      capturedUrl = String(input);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "Xin chào thế giới" } }],
        }),
        { status: 200 },
      );
    });

    const res = await translateWithOllama(["Hello world"], undefined, "vi");
    expect(capturedUrl).toBe("http://localhost:11434/v1/chat/completions");
    expect(res).toEqual(["Xin chào thế giới"]);
  });

  it("romanizes using custom model when specified", async () => {
    interface ChatPayload {
      model?: string;
    }
    let capturedBody: ChatPayload = {};
    global.fetch = vi.fn<typeof fetch>(async (_input, init) => {
      capturedBody = JSON.parse(String(init?.body ?? "{}")) as ChatPayload;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "Konnichiwa" } }],
        }),
        { status: 200 },
      );
    });

    const res = await romanizeWithOllama(["こんにちは"], undefined, undefined, "qwen2.5:7b");
    expect(capturedBody.model).toBe("qwen2.5:7b");
    expect(res).toEqual(["Konnichiwa"]);
  });
});
