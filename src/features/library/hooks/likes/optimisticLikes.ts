import { onAccountChange, type AccountScope } from "./accountScope";

type Override = {
  liked: boolean;
  pending: number;
  settledSeq: number;
  signal: AbortSignal;
};

const overrides = new Map<string, Override>();
const listeners = new Set<() => void>();
let settleSeq = 0;

function notify() {
  listeners.forEach((l) => l());
}

export function onOverridesChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const hasOverrides = () => overrides.size > 0;

export const getOverrideLiked = (trackId: string): boolean | undefined =>
  overrides.get(trackId)?.liked;

export function* overrideEntries(): Generator<[string, boolean]> {
  for (const [id, o] of overrides) yield [id, o.liked];
}

export const currentSettleSeq = () => settleSeq;

function apply(trackId: string, liked: boolean, scope: AccountScope) {
  if (scope.signal.aborted) return;
  const cur = overrides.get(trackId);
  const own = cur?.signal === scope.signal ? cur : undefined;
  overrides.set(trackId, {
    liked,
    pending: (own?.pending ?? 0) + 1,
    settledSeq: own?.settledSeq ?? 0,
    signal: scope.signal,
  });
  notify();
}

export function applyOptimisticLike(trackId: string, scope: AccountScope) {
  apply(trackId, true, scope);
}

export function applyOptimisticUnlike(trackId: string, scope: AccountScope) {
  apply(trackId, false, scope);
}

export function settleOptimistic(
  trackId: string,
  ok: boolean,
  scope: AccountScope,
) {
  const o = overrides.get(trackId);
  if (!o || o.signal !== scope.signal) return;

  o.pending--;
  o.settledSeq = ++settleSeq;

  if (o.pending === 0 && !ok) overrides.delete(trackId);
  notify();
}

export function reconcileOverrides(fetchStartedSeq: number) {
  for (const [id, o] of overrides) {
    if (o.pending === 0 && o.settledSeq <= fetchStartedSeq) {
      overrides.delete(id);
    }
  }
}

onAccountChange(() => {
  overrides.clear();
  notify();
});
