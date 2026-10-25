import {
  asArray,
  asRecord,
  collectByKey,
  numberValue,
  stringValue,
} from "@/shared/utils/json";
import { getText } from "../innertube/innertubeJson";
import { postInnertube } from "../innertube/innertubeClient";
import { TV_ACCOUNT_PROFILE } from "../innertube/playbackProfiles";
import { getYoutubePageId, selectYoutubePageId } from "./youtubeAuthSession";

export interface YoutubeAccount {
  name: string;
  email?: string;
  handle?: string;
  photoUrl?: string;
  pageId?: string;
  hasChannel: boolean;
  isSelected: boolean;
}

function largestPhotoUrl(photo: unknown): string | undefined {
  const thumbnails = asArray(asRecord(photo)?.thumbnails)
    .map(asRecord)
    .filter((entry) => stringValue(entry?.url));
  const largest = thumbnails.sort(
    (a, b) => (numberValue(b?.width) ?? 0) - (numberValue(a?.width) ?? 0),
  )[0];
  const url = stringValue(largest?.url);
  return url?.startsWith("//") ? `https:${url}` : url;
}

function pageIdOf(item: Record<string, unknown>): string | undefined {
  const tokens = asArray(
    asRecord(asRecord(item.serviceEndpoint)?.selectActiveIdentityEndpoint)
      ?.supportedTokens,
  );
  for (const token of tokens) {
    const pageId = stringValue(asRecord(asRecord(token)?.pageIdToken)?.pageId);
    if (pageId) return pageId;
  }
  return undefined;
}

function mapAccount(raw: unknown): YoutubeAccount | null {
  const item = asRecord(raw);
  const name = getText(item?.accountName);
  if (!item || !name) return null;
  const email = getText(item.accountByline);
  const handle = getText(item.channelHandle);
  const photoUrl = largestPhotoUrl(item.accountPhoto);
  const pageId = pageIdOf(item);
  return {
    name,
    ...(email ? { email } : {}),
    ...(handle ? { handle } : {}),
    ...(photoUrl ? { photoUrl } : {}),
    ...(pageId ? { pageId } : {}),
    hasChannel: item.hasChannel === true,
    isSelected: item.isSelected === true,
  };
}

export function parseYoutubeAccounts(body: unknown): YoutubeAccount[] {
  return collectByKey(body, "accountItem")
    .map(mapAccount)
    .filter((account): account is YoutubeAccount => account !== null);
}

export function markSelectedAccount(
  accounts: YoutubeAccount[],
  pageId: string | null,
): YoutubeAccount[] {
  if (!pageId || !accounts.some((account) => account.pageId === pageId))
    return accounts;
  return accounts.map((account) => ({
    ...account,
    isSelected: account.pageId === pageId,
  }));
}

export async function fetchYoutubeAccounts(
  signal?: AbortSignal,
): Promise<YoutubeAccount[]> {
  const pageId = getYoutubePageId();
  const body = await postInnertube(
    "account/accounts_list",
    {
      accountReadMask: {
        returnOwner: true,
        returnBrandAccounts: true,
        returnPersonaAccounts: false,
      },
      callCircumstance: "SWITCHING_USERS_FULL",
    },
    { profile: TV_ACCOUNT_PROFILE, signal },
  );
  const accounts = parseYoutubeAccounts(body);
  if (
    pageId &&
    pageId === getYoutubePageId() &&
    accounts.length > 0 &&
    !accounts.some((account) => account.pageId === pageId)
  )
    selectYoutubePageId(null);
  return markSelectedAccount(accounts, pageId);
}

export function selectedYoutubeAccount(
  accounts: YoutubeAccount[],
): YoutubeAccount | null {
  return accounts.find((account) => account.isSelected) ?? accounts[0] ?? null;
}

export async function fetchYoutubeAccount(
  signal?: AbortSignal,
): Promise<YoutubeAccount | null> {
  return selectedYoutubeAccount(await fetchYoutubeAccounts(signal));
}
