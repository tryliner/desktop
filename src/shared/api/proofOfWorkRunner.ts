import PowWorker from "./proofOfWork.worker?worker&inline";
import { solvePowChallenge, type PowChallenge, type PowSolution } from "./proofOfWork";

type WorkerReply = { ok: true; solution: PowSolution } | { ok: false; message: string };

class WorkerUnavailable extends Error {}

function solveInWorker(challenge: PowChallenge): Promise<PowSolution> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new PowWorker();
    } catch (error) {
      reject(new WorkerUnavailable(String(error)));
      return;
    }
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      worker.terminate();
      if (event.data.ok) resolve(event.data.solution);
      else reject(new Error(event.data.message));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new WorkerUnavailable(event.message || "worker failed"));
    };
    worker.postMessage(challenge);
  });
}

export async function solvePow(challenge: PowChallenge): Promise<PowSolution> {
  try {
    return await solveInWorker(challenge);
  } catch (error) {
    if (error instanceof WorkerUnavailable) return solvePowChallenge(challenge);
    throw error;
  }
}
