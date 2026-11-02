import { describe, it, expect, vi, beforeEach } from "vitest";
import { translateWithClaude, romanizeWithClaude } from "./claudeProvider";

describe("claudeProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls Claude API with proper headers and payload", async () => {
    let capturedUrl = "";
    let capturedHeaders: HeadersInit | undefined;
    interface ClaudePayload {
      model?: string;
      messages?: Array<{ content?: string }>;
    }
    let capturedBody: ClaudePayload = {};

    global.fetch = vi.fn<typeof fetch>(async (input, init) => {
      capturedUrl = String(input);
      capturedHeaders = init?.headers;
      capturedBody = JSON.parse(String(init?.body ?? "{}")) as ClaudePayload;
      return new Response(
        JSON.stringify({
          content: [{ type: "text", text: "Xin chào\nTạm biệt" }],
        }),
        { status: 200 },
      );
    });

    const res = await translateWithClaude(["Hello", "Goodbye"], "sk-ant-test", "vi");
    expect(capturedUrl).toBe("https://api.anthropic.com/v1/messages");
    const headers = new Headers(capturedHeaders);
    expect(headers.get("x-api-key")).toBe("sk-ant-test");
    expect(headers.get("anthropic-version")).toBe("2023-06-01");
    expect(capturedBody.model).toBe("claude-3-5-haiku-20241022");
    expect(res).toEqual(["Xin chào", "Tạm biệt"]);
  });

  it("handles romanization with Claude", async () => {
    global.fetch = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: "Konnichiwa" }],
        }),
        { status: 200 },
      ),
    );

    const res = await romanizeWithClaude(["こんにちは"], "sk-ant-test");
    expect(res).toEqual(["Konnichiwa"]);
  });
});
