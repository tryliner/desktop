import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Button from "@/shared/ui/Button";
import TextInput from "@/shared/ui/TextInput";
import { EyeLine, EyeCloseLine, ArrowLeftLine } from "@mingcute/react";
import { getAuthErrorCode, useAuthStore } from "../store/authStore";
import { useTranslation } from "@/languages";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;

const collapse = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
};

type Props = {
  initialEmail: string;
  onBack: () => void;
  onComplete: (email: string) => void;
};

export default function ForgotPasswordForm({ initialEmail, onBack, onComplete }: Props) {
  const requestPasswordReset = useAuthStore((state) => state.requestPasswordReset);
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const { t } = useTranslation();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const normalizedEmail = email.trim().toLowerCase();

  const resolveErrorMessage = (nextError: unknown): string => {
    const code = getAuthErrorCode(nextError);
    if (code === "server_unavailable") return t("login.errors.server_unavailable");
    if (code === "server_error") return t("login.errors.server_error");
    if (code === "rate_limited") return t("login.errors.rate_limited");
    if (code === "invalid_reset_code") return t("login.errors.reset_code_invalid");
    return t("login.errors.reset_failed");
  };

  const clearMessages = () => {
    if (error) setError("");
    if (notice) setNotice("");
  };

  const sendCode = async (): Promise<boolean> => {
    if (!EMAIL_RE.test(normalizedEmail)) {
      setError(t("login.errors.email_invalid"));
      return false;
    }
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await requestPasswordReset(normalizedEmail);
      return true;
    } catch (nextError) {
      setError(resolveErrorMessage(nextError));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const resendCode = async () => {
    if (submitting) return;
    if (await sendCode()) setNotice(t("login.reset_code_resent"));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    if (step === "request") {
      if (await sendCode()) {
        setCode("");
        setStep("reset");
      }
      return;
    }

    if (!CODE_RE.test(code.trim())) {
      setError(t("login.errors.reset_code_format"));
      return;
    }
    if (password.length < 8) {
      setError(t("login.errors.password_min_8"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("login.errors.password_mismatch"));
      return;
    }

    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await resetPassword(normalizedEmail, code.trim(), password);
      onComplete(normalizedEmail);
    } catch (nextError) {
      setError(resolveErrorMessage(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    if (submitting) return;
    setError("");
    setNotice("");
    if (step === "reset") {
      setStep("request");
      return;
    }
    onBack();
  };

  const passwordToggle = (
    <button
      type="button"
      aria-label={showPassword ? t("login.hide_password") : t("login.show_password")}
      onClick={() => setShowPassword((v) => !v)}
      className="flex h-7 w-7 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text-secondary cursor-pointer"
    >
      {showPassword ? <EyeCloseLine className="h-4 w-4" /> : <EyeLine className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="w-full">
      <h1
        className="m-0 text-[22px] font-[600] leading-tight tracking-[-0.02em] text-text-primary"
        style={{ textWrap: "balance" }}
      >
        {step === "request" ? t("login.reset_title") : t("login.reset_code_title")}
      </h1>
      <p
        className="m-0 mt-[6px] text-[13px] font-[400] leading-[1.5] text-text-secondary"
        style={{ textWrap: "pretty" }}
      >
        {step === "request"
          ? t("login.reset_subtitle")
          : t("login.reset_code_subtitle", { email: normalizedEmail })}
      </p>

      <form onSubmit={submit} className="mt-[20px] flex flex-col">
        <AnimatePresence initial={false} mode="wait">
          {step === "request" ? (
            <motion.div key="reset-request" {...collapse} className="overflow-hidden flex flex-col">
              <label
                className="mb-[7px] text-[12px] font-[500] text-text-secondary"
                htmlFor="reset-email"
              >
                {t("login.label_email")}
              </label>
              <TextInput
                id="reset-email"
                autoFocus
                type="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                autoComplete="email"
                placeholder={t("login.placeholder_email")}
                value={email}
                hasError={Boolean(error)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "reset-form-error" : undefined}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearMessages();
                }}
                disabled={submitting}
              />
            </motion.div>
          ) : (
            <motion.div key="reset-confirm" {...collapse} className="overflow-hidden flex flex-col">
              <div className="mb-[7px] flex items-center justify-between">
                <label className="text-[12px] font-[500] text-text-secondary" htmlFor="reset-code">
                  {t("login.label_reset_code")}
                </label>
                <button
                  type="button"
                  onClick={resendCode}
                  disabled={submitting}
                  className="cursor-pointer rounded-xs border-none bg-transparent p-0 text-[12px] font-[500] text-text-secondary underline-offset-2 transition-colors hover:text-text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text-primary disabled:cursor-default disabled:opacity-50"
                >
                  {t("login.btn_resend_code")}
                </button>
              </div>
              <TextInput
                id="reset-code"
                autoFocus
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={code}
                hasError={Boolean(error)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "reset-form-error" : undefined}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                  clearMessages();
                }}
                disabled={submitting}
              />

              <label
                className="mb-[7px] mt-[15px] text-[12px] font-[500] text-text-secondary"
                htmlFor="reset-password"
              >
                {t("login.label_new_password")}
              </label>
              <TextInput
                id="reset-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder={t("login.placeholder_password_new")}
                value={password}
                hasError={Boolean(error)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "reset-form-error" : undefined}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearMessages();
                }}
                disabled={submitting}
                rightSlot={passwordToggle}
              />

              <label
                className="mb-[7px] mt-[15px] text-[12px] font-[500] text-text-secondary"
                htmlFor="reset-confirm"
              >
                {t("login.label_confirm_password")}
              </label>
              <TextInput
                id="reset-confirm"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder={t("login.placeholder_confirm")}
                value={confirmPassword}
                hasError={Boolean(error)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "reset-form-error" : undefined}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  clearMessages();
                }}
                disabled={submitting}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="min-h-[22px] py-[6px]">
          <AnimatePresence mode="wait" initial={false}>
            {error ? (
              <motion.p
                key={error}
                id="reset-form-error"
                role="alert"
                initial={{ opacity: 0, y: -3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="m-0 text-[12px] font-[500] leading-[1.4] text-accent-primary"
              >
                {error}
              </motion.p>
            ) : notice ? (
              <motion.p
                key={notice}
                role="status"
                initial={{ opacity: 0, y: -3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="m-0 text-[12px] font-[500] leading-[1.4] text-text-secondary"
              >
                {notice}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="mt-[2px] flex items-center gap-[10px]">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={goBack}
            className="w-[110px] shrink-0"
          >
            <ArrowLeftLine className="h-4 w-4" />
            <span className="relative -left-[1.5px] top-[1px]">{t("login.btn_back")}</span>
          </Button>
          <Button type="submit" disabled={submitting} className="flex-1">
            {submitting ? (
              <>
                <span className="h-[14px] w-[14px] animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>
                  {step === "request" ? t("login.btn_sending_code") : t("login.btn_resetting")}
                </span>
              </>
            ) : step === "request" ? (
              t("login.btn_send_code")
            ) : (
              t("login.btn_reset_password")
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
