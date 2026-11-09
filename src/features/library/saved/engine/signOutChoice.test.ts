import { describe, expect, it } from "vitest";
import {
  parseSignOutChoice,
  resolveKeepOnSignOut,
  shouldAskBeforeSignOut,
} from "./signOutChoice";

describe("sign-out choice", () => {
  it("asks by default and on unknown stored values", () => {
    expect(parseSignOutChoice(null)).toBe("ask");
    expect(parseSignOutChoice("maybe")).toBe("ask");
    expect(parseSignOutChoice("keep")).toBe("keep");
    expect(parseSignOutChoice("remove")).toBe("remove");
  });

  it("asks only when set to ask and the account has downloads", () => {
    expect(shouldAskBeforeSignOut({ signOutChoice: "ask", records: [1] })).toBe(
      true,
    );
    expect(shouldAskBeforeSignOut({ signOutChoice: "ask", records: [] })).toBe(
      false,
    );
    expect(
      shouldAskBeforeSignOut({ signOutChoice: "keep", records: [1] }),
    ).toBe(false);
    expect(
      shouldAskBeforeSignOut({ signOutChoice: "remove", records: [1] }),
    ).toBe(false);
  });

  it("uses the dialog answer first, then the saved choice, and removes when unsure", () => {
    expect(resolveKeepOnSignOut("ask", true)).toBe(true);
    expect(resolveKeepOnSignOut("keep", false)).toBe(false);
    expect(resolveKeepOnSignOut("keep", null)).toBe(true);
    expect(resolveKeepOnSignOut("remove", null)).toBe(false);
    expect(resolveKeepOnSignOut("ask", null)).toBe(false);
  });
});
