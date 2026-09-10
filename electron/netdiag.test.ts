import { describe, expect, it } from "vitest";
import { parseTraceOutput } from "./netdiag";

describe("parseTraceOutput", () => {
  it("drops the header and keeps hop lines", () => {
    const out = parseTraceOutput(
      "traceroute to api.tryliner.fun (1.2.3.4), 30 hops max\n 1  10.0.0.1  1.123 ms\n 2  * * *\n 3  1.2.3.4  12.5 ms\n",
    );
    expect(out).toEqual(["1  10.0.0.1  1.123 ms", "2  * * *", "3  1.2.3.4  12.5 ms"]);
  });

  it("handles windows tracert output", () => {
    const out = parseTraceOutput(
      "Tracing route to api.tryliner.fun [1.2.3.4]\nover a maximum of 12 hops:\n  1    <1 ms    10.0.0.1\n",
    );
    expect(out).toEqual(["1    <1 ms    10.0.0.1"]);
  });

  it("caps long output and empty input", () => {
    expect(parseTraceOutput("")).toEqual([]);
    const many = Array.from({ length: 40 }, (_, i) => `${i + 1}  10.0.0.1  1 ms`).join("\n");
    expect(parseTraceOutput(many)).toHaveLength(14);
  });
});
