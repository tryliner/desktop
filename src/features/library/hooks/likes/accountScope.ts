import { getAuthSession } from "@/shared/api";

export type AccountScope = {
  accountId: string;
  signal: AbortSignal;
};

type Active = {
  accountId: string | null;
  controller: AbortController;
};

const listeners = new Set<() => void>();
let active: Active | undefined;

export const currentAccountId = (): string | null =>
  getAuthSession()?.user.id ?? null;

function sync(): Active {
  const accountId = currentAccountId();
  if (!active) {
    active = { accountId, controller: new AbortController() };
    return active;
  }
  if (active.accountId !== accountId) {
    active.controller.abort();
    active = { accountId, controller: new AbortController() };
    listeners.forEach((listener) => listener());
  }
  return active;
}

export function syncAccountScope() {
  sync();
}

export function onAccountChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function captureScope(): AccountScope | null {
  const { accountId, controller } = sync();
  return accountId ? { accountId, signal: controller.signal } : null;
}

export function isScopeActive(scope: AccountScope): boolean {
  sync();
  return !scope.signal.aborted;
}

if (typeof window !== "undefined") {
  window.addEventListener("auth:changed", syncAccountScope);
}
