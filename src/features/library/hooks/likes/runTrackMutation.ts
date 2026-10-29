import { captureScope, type AccountScope } from "./accountScope";
import {
  beginLibraryMutation,
  endLibraryMutation,
  runSerial,
  StaleSessionError,
} from "./mutationQueue";
import { settleOptimistic } from "./optimisticLikes";

export async function runTrackMutation<R>(
  trackId: string,
  apply: (trackId: string, scope: AccountScope) => void,
  call: (trackId: string, signal: AbortSignal) => Promise<R>,
): Promise<R> {
  const scope = captureScope();
  if (!scope) throw new StaleSessionError();

  beginLibraryMutation();
  apply(trackId, scope);

  let ok = false;
  try {
    const result = await runSerial(trackId, scope, (signal) =>
      call(trackId, signal),
    );
    ok = true;
    return result;
  } finally {
    settleOptimistic(trackId, ok, scope);
    endLibraryMutation();
  }
}
