import { ApiError } from "../apiError";
import { getLocalImportHandler } from "../localImports";
import type {
  ImportJob,
  ImportReview,
  ImportReviewDecision,
  Track,
} from "@/shared/contracts";

export const importsApi = {
  getPlaylistImport(importId: string): Promise<ImportJob> {
    const job = getLocalImportHandler().getJob(importId);
    return job
      ? Promise.resolve(job)
      : Promise.reject(new ApiError(404, "Import was not found."));
  },

  getPlaylistImportReview(
    importId: string,
  ): Promise<{ items: ImportReview[] }> {
    return Promise.resolve({
      items: getLocalImportHandler().getReview(importId),
    });
  },

  decidePlaylistImportReview(
    importId: string,
    decisions: ImportReviewDecision[],
    tracks?: Track[],
    title?: string,
    description?: string,
  ): Promise<{ approved: string[]; denied: string[]; finalized?: boolean }> {
    return getLocalImportHandler()
      .finalize(importId, tracks ?? [], title, description)
      .then(({ finalized }) => ({
        approved: decisions
          .filter((d) => d.decision === "approve")
          .map((d) => d.reviewId),
        denied: decisions
          .filter((d) => d.decision === "deny")
          .map((d) => d.reviewId),
        finalized,
      }));
  },

  skipPlaylistImportReview(
    importId: string,
    tracks?: Track[],
    title?: string,
    description?: string,
  ): Promise<{ denied: "all"; finalized: boolean }> {
    return getLocalImportHandler()
      .finalize(importId, tracks ?? [], title, description)
      .then(({ finalized }) => ({ denied: "all" as const, finalized }));
  },
};
