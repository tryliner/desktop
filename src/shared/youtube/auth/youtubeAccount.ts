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

export interface YoutubeAccount {
  name: string;
  email?: string;
  handle?: string;
  photoUrl?: string;
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

function mapAccount(raw: unknown): YoutubeAccount | null {
  const item = asRecord(raw);
  const name = getText(item?.accountName);
  if (!item || !name) return null;
  const email = getText(item.accountByline);
  const handle = getText(item.channelHandle);
  const photoUrl = largestPhotoUrl(item.accountPhoto);
  return {
    name,
    ...(email ? { email } : {}),
    ...(handle ? { handle } : {}),
    ...(photoUrl ? { photoUrl } : {}),
    hasChannel: item.hasChannel === true,
    isSelected: item.isSelected === true,
  };
}

export function parseYoutubeAccounts(body: unknown): YoutubeAccount[] {
  return collectByKey(body, "accountItem")
    .map(mapAccount)
    .filter((account): account is YoutubeAccount => account !== null);
}

export async function fetchYoutubeAccount(
  signal?: AbortSignal,
): Promise<YoutubeAccount | null> {
  const body = await postInnertube(
    "account/accounts_list",
    {},
    { profile: TV_ACCOUNT_PROFILE, signal },
  );
  const accounts = parseYoutubeAccounts(body);
  return accounts.find((account) => account.isSelected) ?? accounts[0] ?? null;
}
