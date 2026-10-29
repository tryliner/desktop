import { beforeEach, describe, expect, it, vi } from "vitest";

const flush = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const reasonOf = (result: PromiseSettledResult<unknown>) =>
  result.status === "rejected" ? result.reason : undefined;

const auth = vi.hoisted(() => ({
  session: null as { accessToken: string; user: { id: string } } | null,
}));

vi.mock("@/shared/api", () => ({ getAuthSession: () => auth.session }));
vi.mock("./notifyLibraryChanged", () => ({ notifyLibraryChanged: vi.fn() }));

const signIn = (id: string, accessToken = "token") => {
  auth.session = { accessToken, user: { id } };
};
const signOut = () => {
  auth.session = null;
};

async function setup() {
  vi.resetModules();
  const scope = await import("./accountScope");
  const likes = await import("./optimisticLikes");
  const queue = await import("./mutationQueue");
  const { runTrackMutation } = await import("./runTrackMutation");
  return { scope, likes, queue, runTrackMutation };
}

beforeEach(signOut);

describe("cancelling like/unlike work when the account changes", () => {
  it("cancels queued and in-flight work when another account signs in", async () => {
    const { scope, likes, queue, runTrackMutation } = await setup();
    signIn("a");
    const inFlight = deferred();
    const call = vi
      .fn()
      .mockReturnValueOnce(inFlight.promise)
      .mockResolvedValue(undefined);

    const like = runTrackMutation("t1", likes.applyOptimisticLike, call);
    const unlike = runTrackMutation("t1", likes.applyOptimisticUnlike, call);
    await flush();
    expect(call).toHaveBeenCalledTimes(1);

    signIn("b");
    scope.syncAccountScope();
    const results = await Promise.allSettled([like, unlike]);
    inFlight.resolve();
    await flush();

    for (const result of results) {
      expect(reasonOf(result)).toBeInstanceOf(queue.StaleSessionError);
    }
    expect(call).toHaveBeenCalledTimes(1);
    expect(likes.hasOverrides()).toBe(false);
  });

  it("does not resume old work after sign-out and sign-in as the same account", async () => {
    const { scope, likes, runTrackMutation } = await setup();
    signIn("a");
    const inFlight = deferred();
    const call = vi
      .fn()
      .mockReturnValueOnce(inFlight.promise)
      .mockResolvedValue(undefined);
    const like = runTrackMutation("t1", likes.applyOptimisticLike, call);
    const unlike = runTrackMutation("t1", likes.applyOptimisticUnlike, call);
    await flush();

    signOut();
    scope.syncAccountScope();
    signIn("a");
    scope.syncAccountScope();
    const results = await Promise.allSettled([like, unlike]);
    inFlight.resolve();
    await flush();

    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect(call).toHaveBeenCalledTimes(1);
    expect(likes.hasOverrides()).toBe(false);
  });

  it("aborts the signal handed to the API call when the account changes", async () => {
    const { scope, likes, runTrackMutation } = await setup();
    signIn("a");
    const inFlight = deferred();
    const seen: AbortSignal[] = [];
    const run = runTrackMutation("t1", likes.applyOptimisticLike, (_id, signal) => {
      seen.push(signal);
      return inFlight.promise;
    });
    await flush();
    expect(seen[0]?.aborted).toBe(false);

    signIn("b");
    scope.syncAccountScope();
    await Promise.allSettled([run]);

    expect(seen[0]?.aborted).toBe(true);
  });

  it("rejects a mutation started while signed out", async () => {
    const { likes, queue, runTrackMutation } = await setup();
    const call = vi.fn();

    await expect(
      runTrackMutation("t1", likes.applyOptimisticLike, call),
    ).rejects.toBeInstanceOf(queue.StaleSessionError);
    expect(call).not.toHaveBeenCalled();
    expect(likes.hasOverrides()).toBe(false);
  });

  it("lets the next account mutate normally after the previous one left", async () => {
    const { scope, likes, runTrackMutation } = await setup();
    signIn("a");
    const never = deferred();
    const a = runTrackMutation("t1", likes.applyOptimisticLike, () => never.promise);
    await flush();

    signOut();
    scope.syncAccountScope();
    signIn("b");
    scope.syncAccountScope();
    await Promise.allSettled([a]);

    const call = vi.fn().mockResolvedValue("ok");
    await expect(
      runTrackMutation("t1", likes.applyOptimisticLike, call),
    ).resolves.toBe("ok");
    expect(call).toHaveBeenCalledTimes(1);
    expect(likes.getOverrideLiked("t1")).toBe(true);
  });
});

describe("settling like/unlike work across account changes", () => {
  it("does not let a stale completion touch the new account's override", async () => {
    const { scope, likes, runTrackMutation } = await setup();
    signIn("a");
    const lateA = deferred();
    const a = runTrackMutation("t1", likes.applyOptimisticLike, () => lateA.promise);
    await flush();

    signIn("b");
    scope.syncAccountScope();
    const holdB = deferred();
    const b = runTrackMutation("t1", likes.applyOptimisticLike, () => holdB.promise);

    lateA.reject(new Error("late failure of account a"));
    await Promise.allSettled([a]);
    expect(likes.getOverrideLiked("t1")).toBe(true);

    holdB.resolve();
    await b;
    expect(likes.getOverrideLiked("t1")).toBe(true);
  });

  it("drops a settled override that was not reconciled when the account changes", async () => {
    const { scope, likes, runTrackMutation } = await setup();
    signIn("a");
    await runTrackMutation("t1", likes.applyOptimisticLike, () => Promise.resolve());
    expect(likes.getOverrideLiked("t1")).toBe(true);

    signIn("b");
    scope.syncAccountScope();

    expect(likes.getOverrideLiked("t1")).toBeUndefined();
    expect(likes.hasOverrides()).toBe(false);
  });

  it("keeps work alive when the token refreshes for the same account", async () => {
    const { scope, likes, runTrackMutation } = await setup();
    signIn("a", "token-1");
    const inFlight = deferred<string>();
    const run = runTrackMutation("t1", likes.applyOptimisticLike, () => inFlight.promise);
    await flush();

    signIn("a", "token-2");
    scope.syncAccountScope();
    inFlight.resolve("ok");

    await expect(run).resolves.toBe("ok");
  });

  it("keeps like and unlike of one track in order", async () => {
    const { likes, runTrackMutation } = await setup();
    signIn("a");
    const order: string[] = [];
    const first = deferred();

    const like = runTrackMutation("t1", likes.applyOptimisticLike, async () => {
      order.push("like:start");
      await first.promise;
      order.push("like:end");
    });
    const unlike = runTrackMutation("t1", likes.applyOptimisticUnlike, async () => {
      order.push("unlike:start");
    });
    await flush();
    expect(order).toEqual(["like:start"]);

    first.resolve();
    await Promise.all([like, unlike]);
    expect(order).toEqual(["like:start", "like:end", "unlike:start"]);
  });
});
