import { afterEach, describe, expect, it, vi } from "vitest";

const { postInnertube, getYoutubePageId, selectYoutubePageId } = vi.hoisted(
  () => ({
    postInnertube: vi.fn(),
    getYoutubePageId: vi.fn(),
    selectYoutubePageId: vi.fn(),
  }),
);

vi.mock("../innertube/innertubeClient", () => ({ postInnertube }));
vi.mock("./youtubeAuthSession", () => ({
  getYoutubePageId,
  selectYoutubePageId,
}));

import {
  fetchYoutubeAccounts,
  markSelectedAccount,
  parseYoutubeAccounts,
} from "./youtubeAccount";

afterEach(() => {
  vi.clearAllMocks();
});

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

describe("fetchYoutubeAccounts", () => {
  it("drops a stored brand account that youtube no longer lists", async () => {
    postInnertube.mockResolvedValue(body);
    getYoutubePageId.mockReturnValue("gone");
    const accounts = await fetchYoutubeAccounts();
    expect(selectYoutubePageId).toHaveBeenCalledWith(null);
    expect(accounts.filter((account) => account.isSelected)).toMatchObject([
      { name: "Main" },
    ]);
  });

  it("keeps a stored brand account that is still listed", async () => {
    postInnertube.mockResolvedValue(body);
    getYoutubePageId.mockReturnValue("222");
    await fetchYoutubeAccounts();
    expect(selectYoutubePageId).not.toHaveBeenCalled();
  });

  it("keeps the stored brand account when the list is empty or fails", async () => {
    getYoutubePageId.mockReturnValue("222");
    postInnertube.mockResolvedValueOnce({});
    await expect(fetchYoutubeAccounts()).resolves.toEqual([]);
    postInnertube.mockRejectedValueOnce(new Error("offline"));
    await expect(fetchYoutubeAccounts()).rejects.toThrow("offline");
    expect(selectYoutubePageId).not.toHaveBeenCalled();
  });

  it("keeps a brand account picked while the list was loading", async () => {
    postInnertube.mockResolvedValue(body);
    getYoutubePageId.mockReturnValueOnce("gone").mockReturnValue("picked");
    await fetchYoutubeAccounts();
    expect(selectYoutubePageId).not.toHaveBeenCalled();
  });
});
