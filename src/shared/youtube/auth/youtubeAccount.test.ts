import { describe, expect, it } from "vitest";
import { markSelectedAccount, parseYoutubeAccounts } from "./youtubeAccount";

function accountItem(name: string, pageId?: string, isSelected = false) {
  return {
    accountItem: {
      accountName: { simpleText: name },
      isSelected,
      hasChannel: true,
      serviceEndpoint: {
        selectActiveIdentityEndpoint: {
          supportedTokens: [
            { accountStateToken: { hasChannel: true } },
            ...(pageId ? [{ pageIdToken: { pageId } }] : []),
          ],
        },
      },
    },
  };
}

const body = {
  contents: [
    {
      accountSectionListRenderer: {
        contents: [
          {
            accountItemSectionRenderer: {
              contents: [
                accountItem("Main", undefined, true),
                accountItem("Music", "111"),
                accountItem("Videos", "222"),
              ],
            },
          },
        ],
      },
    },
  ],
};

describe("youtube accounts", () => {
  it("reads the brand account page id from the identity tokens", () => {
    const accounts = parseYoutubeAccounts(body);
    expect(accounts.map((account) => [account.name, account.pageId])).toEqual([
      ["Main", undefined],
      ["Music", "111"],
      ["Videos", "222"],
    ]);
  });

  it("marks the stored brand account as selected", () => {
    const accounts = markSelectedAccount(parseYoutubeAccounts(body), "111");
    expect(accounts.filter((account) => account.isSelected)).toMatchObject([
      { name: "Music" },
    ]);
  });

  it("keeps youtube's selection when no brand account matches", () => {
    for (const pageId of [null, "missing"]) {
      const accounts = markSelectedAccount(parseYoutubeAccounts(body), pageId);
      expect(accounts.filter((account) => account.isSelected)).toMatchObject([
        { name: "Main" },
      ]);
    }
  });
});
