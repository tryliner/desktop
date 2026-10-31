import { planLimitMessage } from "@/shared/api";
import { showToast } from "@/shared/ui";
import { createTranslatorSync, getStoredLocale } from "@/languages";

export function notifyPlanLimit(err: unknown): void {
  const message = planLimitMessage(
    err,
    createTranslatorSync(getStoredLocale()),
  );
  if (message) showToast(message, "error", { id: "plan-limit-toast" });
}
