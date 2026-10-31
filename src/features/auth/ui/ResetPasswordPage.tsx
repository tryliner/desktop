import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckLine,
  CloseLine,
  EyeCloseLine,
  EyeLine,
} from "@mingcute/react";
import Button from "@/shared/ui/Button";
import TextInput from "@/shared/ui/TextInput";
import WindowControls from "@/features/navigation/ui/WindowControls";
import { useWindowState } from "@/features/navigation/hooks/useWindowState";
import { api, ApiError } from "@/shared/api";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import LoginBrandPanel from "./LoginBrandPanel";
import LoginBackdrop from "./LoginBackdrop";
import { useAuthStore } from "../store/authStore";

const MIN_PASSWORD = 8;
const TOKEN_RE = /^lrst_[A-Za-z0-9_-]{43}$/;
const EASE = [0.22, 1, 0.36, 1] as const;

type Stage =
  | { kind: "loading" }
  | { kind: "form"; maskedEmail: string }
  | { kind: "done" }
  | { kind: "invalid" }
  | { kind: "offline" };

// opened from liner://reset-password?id=<token> (a link Liner support emailed);
// same flow as link.tryliner.fun/reset/<token> in the browser
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { isEdgeToEdge } = useWindowState();
  const { t } = useTranslation();
  const status = useAuthStore((state) => state.status);
  const logout = useAuthStore((state) => state.logout);

  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<"password" | "confirm" | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!TOKEN_RE.test(token)) {
      setStage({ kind: "invalid" });
      return;
    }
    let cancelled = false;
    setStage({ kind: "loading" });
    api
      .getPasswordReset(token)
      .then((link) => {
        if (!cancelled) setStage({ kind: "form", maskedEmail: link.maskedEmail });
      })
      .catch((err) => {
        if (cancelled) return;
        setStage(
          err instanceof ApiError && err.status === 410
            ? { kind: "invalid" }
            : { kind: "offline" },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  const fail = (message: string, field: "password" | "confirm" | null) => {
    setError(message);
    setErrorField(field);
  };

  const clearError = () => {
    if (error) fail("", null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (password.length < MIN_PASSWORD) {
      fail(t("login.errors.password_min_8"), "password");
      return;
    }
    if (password !== confirm) {
      fail(t("login.errors.password_mismatch"), "confirm");
      return;
    }
    fail("", null);
    setSubmitting(true);
    try {
      await api.completePasswordReset(token, password);
      setPassword("");
      setConfirm("");
      // every session of the account was just ended on the server, this one too
      if (useAuthStore.getState().status === "authenticated") await logout();
      setStage({ kind: "done" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) {
        setStage({ kind: "invalid" });
      } else if (err instanceof ApiError && err.status === 429) {
        fail(t("reset_password.errors.too_many"), null);
      } else if (err instanceof ApiError && err.status === 400) {
        fail(t("login.errors.password_min_8"), "password");
      } else if (err instanceof ApiError && err.status === 0) {
        fail(t("login.errors.server_unavailable"), null);
      } else {
        fail(t("login.errors.server_error"), null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const leave = () =>
    navigate(status === "authenticated" ? "/" : "/login", { replace: true });

  const brand =
    stage.kind === "done"
      ? {
          title: t("reset_password.brand_done_title"),
          subtitle: t("reset_password.brand_done_subtitle"),
        }
      : stage.kind === "invalid"
        ? {
            title: t("reset_password.brand_invalid_title"),
            subtitle: t("reset_password.brand_invalid_subtitle"),
          }
        : {
            title: t("reset_password.title"),
            subtitle: t("reset_password.subtitle"),
          };

  const eye = (visible: boolean, toggle: () => void) => (
    <button
      type="button"
      aria-label={visible ? t("login.hide_password") : t("login.show_password")}
      onClick={toggle}
      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-xl text-text-tertiary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text-secondary"
    >
      {visible ? (
        <EyeCloseLine className="h-4 w-4" />
      ) : (
        <EyeLine className="h-4 w-4" />
      )}
    </button>
  );

  return (
    <main
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden bg-bg-primary",
        isEdgeToEdge
          ? "rounded-none border-0"
          : "rounded-5xl border border-border-primary",
      )}
    >
      <LoginBackdrop edgeToEdge={isEdgeToEdge} />
      <WindowControls variant="glass" isFullscreen />

      <section className="relative z-10 mx-4 my-auto grid max-h-[calc(100%-48px)] w-full max-w-[780px] grid-cols-[300px_1fr] gap-[8px] overflow-y-auto rounded-[20px] border border-border-primary bg-bg-panel p-[8px]">
        <LoginBrandPanel title={brand.title} subtitle={brand.subtitle} />

        <div className="flex min-h-[400px] w-full flex-col px-[28px] pb-[22px] pt-[26px]">
          <AnimatePresence mode="wait" initial={false}>
            {stage.kind === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-1 items-center justify-center"
              >
                <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-text-tertiary border-t-transparent" />
              </motion.div>
            )}

            {stage.kind === "form" && (
              <motion.form
                key="form"
                noValidate
                onSubmit={submit}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="flex flex-1 flex-col"
              >
                <div className="flex items-center gap-[10px] rounded-[10px] border border-border-primary bg-bg-primary px-[14px] py-[12px] text-[13px] text-text-secondary">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                  <span className="min-w-0 break-all">
                    {t("reset_password.account")}{" "}
                    <span className="font-[500] text-text-primary">
                      {stage.maskedEmail}
                    </span>
                  </span>
                </div>

                <label
                  className="mb-[7px] mt-[18px] text-[12px] font-[500] text-text-secondary"
                  htmlFor="reset-password"
                >
                  {t("reset_password.label_new")}
                </label>
                <TextInput
                  id="reset-password"
                  autoFocus
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder={t("login.placeholder_password_new")}
                  value={password}
                  maxLength={1024}
                  hasError={errorField === "password"}
                  aria-invalid={errorField === "password"}
                  aria-describedby={error ? "reset-error" : undefined}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    clearError();
                  }}
                  disabled={submitting}
                  rightSlot={eye(showPassword, () => setShowPassword((v) => !v))}
                />
                <span
                  className={cn(
                    "mt-1 text-[11px]",
                    password.length >= MIN_PASSWORD
                      ? "text-emerald-500"
                      : "text-text-tertiary",
                  )}
                >
                  {t("reset_password.hint_length")}
                </span>

                <label
                  className="mb-[7px] mt-[14px] text-[12px] font-[500] text-text-secondary"
                  htmlFor="reset-confirm"
                >
                  {t("login.label_confirm_password")}
                </label>
                <TextInput
                  id="reset-confirm"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder={t("login.placeholder_confirm")}
                  value={confirm}
                  maxLength={1024}
                  hasError={errorField === "confirm"}
                  aria-invalid={errorField === "confirm"}
                  aria-describedby={error ? "reset-error" : undefined}
                  onChange={(event) => {
                    setConfirm(event.target.value);
                    clearError();
                  }}
                  disabled={submitting}
                  rightSlot={eye(showConfirm, () => setShowConfirm((v) => !v))}
                />

                <div className="min-h-[22px] py-[6px]">
                  <AnimatePresence mode="wait" initial={false}>
                    {error && (
                      <motion.p
                        key={error}
                        id="reset-error"
                        role="alert"
                        initial={{ opacity: 0, y: -3 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="m-0 text-[12px] font-[500] leading-[1.4] text-accent-primary"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="mt-[2px] w-full"
                >
                  {submitting ? (
                    <>
                      <span className="h-[14px] w-[14px] animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>{t("reset_password.btn_saving")}</span>
                    </>
                  ) : (
                    t("reset_password.btn_change")
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={submitting}
                  onClick={leave}
                  className="mt-[8px] w-full"
                >
                  {t("reset_password.btn_cancel")}
                </Button>
              </motion.form>
            )}

            {(stage.kind === "done" ||
              stage.kind === "invalid" ||
              stage.kind === "offline") && (
              <motion.div
                key={stage.kind}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="flex flex-1 flex-col items-center justify-center px-2 text-center"
              >
                <div
                  className={cn(
                    "mb-[18px] flex h-14 w-14 items-center justify-center rounded-full",
                    stage.kind === "done"
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-accent-primary/15 text-accent-primary",
                  )}
                >
                  {stage.kind === "done" ? (
                    <CheckLine className="h-6 w-6" />
                  ) : (
                    <CloseLine className="h-6 w-6" />
                  )}
                </div>
                <h2 className="m-0 text-[20px] font-[650] tracking-[-0.02em] text-text-primary">
                  {t(`reset_password.${stage.kind}_title`)}
                </h2>
                <p
                  className="m-0 mt-[8px] max-w-[320px] text-[13.5px] leading-[1.5] text-text-secondary"
                  style={{ textWrap: "pretty" }}
                >
                  {t(`reset_password.${stage.kind}_text`)}
                </p>
                <div className="mt-[22px] flex w-full max-w-[280px] flex-col gap-[8px]">
                  {stage.kind === "offline" && (
                    <Button
                      type="button"
                      onClick={() => setAttempt((n) => n + 1)}
                      className="w-full"
                    >
                      {t("reset_password.btn_retry")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant={stage.kind === "offline" ? "ghost" : "primary"}
                    onClick={() => navigate("/login", { replace: true })}
                    className="w-full"
                  >
                    {stage.kind === "done"
                      ? t("login.btn_sign_in")
                      : t("reset_password.btn_back_to_sign_in")}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </main>
  );
}
