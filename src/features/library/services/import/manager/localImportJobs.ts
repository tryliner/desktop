import {
  LOCAL_IMPORT_PREFIX,
  registerLocalImportHandler,
} from "@/shared/api/localImports";
import type {
  ImportJob,
  ImportReview,
  ImportSource,
  Track,
} from "@/shared/contracts";
import { finalizeImportedPlaylist } from "./finalizeImport";

interface LocalImportRecord {
  job: ImportJob;
  reviewItems: ImportReview[];
}

type JobListener = (job: ImportJob) => void;

const records = new Map<string, LocalImportRecord>();
const listeners = new Set<JobListener>();

function newJobId(): string {
  const random =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${LOCAL_IMPORT_PREFIX}${random}`;
}

export function createLocalImportJob(
  source: ImportSource,
  sourceUrl: string,
): ImportJob {
  const job: ImportJob = {
    id: newJobId(),
    source,
    sourceUrl,
    status: "running",
    requiresDecision: false,
    result: { total: 0, imported: 0, skipped: 0 },
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
  };
  records.set(job.id, { job, reviewItems: [] });
  return job;
}

export function updateLocalImportJob(
  jobId: string,
  patch: Partial<ImportJob>,
  reviewItems?: ImportReview[],
): ImportJob | undefined {
  const record = records.get(jobId);
  if (!record) return undefined;
  record.job = { ...record.job, ...patch };
  if (reviewItems) record.reviewItems = reviewItems;
  listeners.forEach((listener) => listener(record.job));
  return record.job;
}

export function onLocalImportJobChange(listener: JobListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function finalizeLocalImport(
  jobId: string,
  tracks: Track[],
  title?: string,
  description?: string,
): Promise<{ finalized: boolean }> {
  const record = records.get(jobId);
  if (!record) throw new Error("Import was not found.");
  if (record.job.status === "completed") return { finalized: true };
  const total = record.job.result?.total ?? tracks.length;
  updateLocalImportJob(jobId, { status: "finalizing" });
  try {
    const { playlistId, saved } = await finalizeImportedPlaylist(
      title || record.job.title || "Imported playlist",
      description ?? record.job.description,
      tracks,
    );
    updateLocalImportJob(
      jobId,
      {
        status: "completed",
        requiresDecision: false,
        playlistId,
        result: { total, imported: saved, skipped: Math.max(0, total - saved) },
        finishedAt: new Date().toISOString(),
      },
      [],
    );
    return { finalized: true };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to save imported playlist";
    updateLocalImportJob(jobId, {
      status: "failed",
      error: { code: "FINALIZE_FAILED", message },
      finishedAt: new Date().toISOString(),
    });
    throw error;
  }
}

registerLocalImportHandler({
  getJob: (jobId) => records.get(jobId)?.job,
  getReview: (jobId) => records.get(jobId)?.reviewItems ?? [],
  finalize: finalizeLocalImport,
});
