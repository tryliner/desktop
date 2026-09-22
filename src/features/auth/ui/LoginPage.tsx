import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Button from "@/shared/ui/Button";
import TextInput from "@/shared/ui/TextInput";
import Select from "@/shared/ui/Select";
import { EyeLine, EyeCloseLine, ArrowLeftLine } from "@mingcute/react";
import WindowControls from "@/features/navigation/ui/WindowControls";
import logo from "@/assets/logo.svg";
import cloudsBanner from "@/assets/wallhaven-5g1yz8.jpg";
import CircleDitherCanvas from "@/shared/ui/CircleDitherCanvas";
import AppImage from "@/features/covers/ui/AppImage";
import {
  authErrorMessage,
  getAuthErrorCode,
  useAuthStore,
} from "../store/authStore";
import { useTranslation, LOCALE_OPTIONS } from "@/languages";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const { locale, setLocale, t } = useTranslation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectMode = (next: "login" | "register") => {
    if (submitting || next === mode) return;
    setMode(next);
    setRegisterStep(1);
    setError("");
    setConfirmPassword("");
  };

  const resolveErrorMessage = (nextError: unknown): string => {
    const code = getAuthErrorCode(nextError);
    if (code === "server_unavailable")
      return t("login.errors.server_unavailable");
    if (code === "invalid_credentials")
      return t("login.errors.invalid_credentials");
    if (code === "email_already_used")
      return t("login.errors.email_already_used");
    if (code === "username_taken")
      return t("login.errors.username_taken");
    if (code === "invalid_username")
      return t("login.errors.username_invalid");
    if (code === "invalid_input")
      return t("login.errors.display_name_required");
    return authErrorMessage(nextError);
  };

  const handleStep1Continue = () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      setError(t("login.errors.email_invalid"));
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
    setError("");

    // Provide friendly suggestions from email prefix if fields are empty
    if (!username) {
      const autoHandle = normalizedEmail
        .split("@")[0]
        ?.replace(/[^a-z0-9_]/g, "")
        .slice(0, 30);
      if (autoHandle && autoHandle.length >= 3) {
        setUsername(autoHandle);
      }
    }
    if (!displayName) {
      const autoName = normalizedEmail.split("@")[0];
      if (autoName) {
        setDisplayName(autoName);
      }
    }

    setRegisterStep(2);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    if (mode === "login") {
      const normalizedEmail = email.trim().toLowerCase();
      if (!EMAIL_RE.test(normalizedEmail)) {
        setError(t("login.errors.email_invalid"));
        return;
      }
      if (password.length < 8) {
        setError(t("login.errors.password_min_8"));
        return;
      }
      setSubmitting(true);
      setError("");
      try {
        await login(normalizedEmail, password);
        navigate("/", { replace: true });
      } catch (nextError) {
        setError(resolveErrorMessage(nextError));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // mode === "register"
    if (registerStep === 1) {
      handleStep1Continue();
      return;
    }

    // registerStep === 2
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();

    if (!USERNAME_RE.test(normalizedUsername)) {
      setError(t("login.errors.username_invalid"));
      return;
    }
    if (!cleanDisplayName) {
      setError(t("login.errors.display_name_required"));
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await register(
        normalizedEmail,
        password,
        normalizedUsername,
        cleanDisplayName,
      );
      navigate("/", { replace: true });
    } catch (nextError) {
      const code = getAuthErrorCode(nextError);
      if (code === "email_already_used") {
        setRegisterStep(1);
        setError(t("login.errors.email_already_used"));
      } else {
        setError(resolveErrorMessage(nextError));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-5xl border border-border-primary bg-bg-primary">
      <div className="absolute inset-0 z-0 select-none overflow-hidden rounded-5xl">
        <CircleDitherCanvas
          src={cloudsBanner}
          alt="Clouds Dither Background"
          dotSize={7}
          gap={0.5}
          edgePadding={1.5}
          cornerRadius={12}
          gridType="square"
          objectFit="cover"
          className="h-full w-full rounded-5xl overflow-hidden"
        />
      </div>

      <WindowControls variant="glass" />

      {/* Centered solid panel in new app style — bg stays visible around it */}
      <section className="relative z-10 mx-4 my-auto flex max-h-[calc(100%-48px)] w-full max-w-[400px] flex-col overflow-y-auto rounded-xl border border-border-primary bg-bg-panel p-[28px]">
        <div className="flex min-h-full w-full flex-col justify-between">
          {/* Top: logo + lang picker */}
          <div className="flex shrink-0 items-center gap-[10px]">
            <AppImage
              src={logo}
              alt="Liner"
              width={25}
              height={30}
              className="theme-logo h-[22px] w-auto"
              priority
            />
            <span className="text-[16px] font-[600] tracking-[-0.025em] text-text-primary">
              Liner
            </span>
            <Select
              options={LOCALE_OPTIONS}
              value={locale}
              onChange={setLocale}
              align="bottom-right"
              variant="transparent"
              className="ml-auto"
              aria-label={t("login.select_language")}
            />
          </div>

          {/* Middle: grows + centers form content */}
          <div className="my-auto flex flex-col justify-center py-6">
            <div className="w-full">
              {/* mode switch, same segmented pattern as create-playlist tabs */}
              <div className="mb-[16px] flex rounded-lg bg-bg-elevated p-[3px]">
                {(
                  [
                    { id: "login", label: t("login.btn_sign_in") },
                    { id: "register", label: t("login.btn_create_account") },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectMode(item.id)}
                    className={`h-[30px] flex-1 cursor-pointer rounded-md border-none text-[13px] font-[500] transition-all ${
                      mode === item.id
                        ? "bg-bg-primary text-text-primary"
                        : "bg-transparent text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <AnimatePresence initial={false}>
                {mode === "register" && (
                  <motion.div
                    key="step-indicator"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      duration: 0.18,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="overflow-hidden"
                  >
                    <div className="mb-2">
                      <span className="inline-flex items-center rounded-full border border-border-primary bg-bg-elevated px-2.5 py-0.5 text-[11px] font-[500] text-text-secondary">
                        {t("login.step_indicator", { step: registerStep, total: 2 })}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <h1
                className="m-0 text-[22px] font-[600] leading-tight tracking-[-0.02em] text-text-primary"
                style={{ textWrap: "balance" }}
              >
                {mode === "login"
                  ? t("login.auth_title_login")
                  : registerStep === 1
                    ? t("login.auth_title_register")
                    : t("login.profile_setup_title")}
              </h1>
              <p
                className="m-0 mt-[6px] text-[13px] font-[400] leading-[1.5] text-text-secondary"
                style={{ textWrap: "pretty" }}
              >
                {mode === "login"
                  ? t("login.auth_subtitle_login")
                  : registerStep === 1
                    ? t("login.auth_subtitle_register")
                    : t("login.profile_setup_subtitle")}
              </p>

              <form onSubmit={submit} className="mt-[20px] flex flex-col">
                <AnimatePresence initial={false}>
                  {mode === "login" || registerStep === 1 ? (
                    <motion.div
                      key="step-credentials"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        duration: 0.18,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="overflow-hidden flex flex-col"
                    >
                      <label
                        className="mb-[7px] text-[12px] font-[500] text-text-secondary"
                        htmlFor="auth-email"
                      >
                        {t("login.label_email")}
                      </label>
                      <TextInput
                        id="auth-email"
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
                        aria-describedby={error ? "auth-form-error" : undefined}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          if (error) setError("");
                        }}
                        disabled={submitting}
                      />

                      <label
                        className="mb-[7px] mt-[15px] text-[12px] font-[500] text-text-secondary"
                        htmlFor="auth-password"
                      >
                        {t("login.label_password")}
                      </label>
                      <TextInput
                        id="auth-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={
                          mode === "login" ? "current-password" : "new-password"
                        }
                        placeholder={
                          mode === "login"
                            ? t("login.placeholder_password")
                            : t("login.placeholder_password_new")
                        }
                        value={password}
                        hasError={Boolean(error)}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? "auth-form-error" : undefined}
                        onChange={(event) => {
                          setPassword(event.target.value);
                          if (error) setError("");
                        }}
                        disabled={submitting}
                        rightSlot={
                          <button
                            type="button"
                            aria-label={
                              showPassword
                                ? t("login.hide_password")
                                : t("login.show_password")
                            }
                            onClick={() => setShowPassword((v) => !v)}
                            className="flex h-7 w-7 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text-secondary cursor-pointer"
                          >
                            {showPassword ? (
                              <EyeCloseLine className="h-4 w-4" />
                            ) : (
                              <EyeLine className="h-4 w-4" />
                            )}
                          </button>
                        }
                      />

                      <AnimatePresence initial={false}>
                        {mode === "register" && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                              duration: 0.18,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className="overflow-hidden"
                          >
                            <label
                              className="mb-[7px] mt-[15px] block text-[12px] font-[500] text-text-secondary"
                              htmlFor="auth-confirm"
                            >
                              {t("login.label_confirm_password")}
                            </label>
                            <TextInput
                              id="auth-confirm"
                              type={showConfirmPassword ? "text" : "password"}
                              autoComplete="new-password"
                              placeholder={t("login.placeholder_confirm")}
                              value={confirmPassword}
                                    hasError={Boolean(error)}
                              aria-invalid={Boolean(error)}
                              aria-describedby={error ? "auth-form-error" : undefined}
                              onChange={(event) => {
                                setConfirmPassword(event.target.value);
                                if (error) setError("");
                              }}
                              disabled={submitting}
                              rightSlot={
                                <button
                                  type="button"
                                  aria-label={
                                    showConfirmPassword
                                      ? t("login.hide_password")
                                      : t("login.show_password")
                                  }
                                  onClick={() => setShowConfirmPassword((v) => !v)}
                                  className="flex h-7 w-7 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text-secondary cursor-pointer"
                                >
                                  {showConfirmPassword ? (
                                    <EyeCloseLine className="h-4 w-4" />
                                  ) : (
                                    <EyeLine className="h-4 w-4" />
                                  )}
                                </button>
                              }
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="step-profile"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        duration: 0.18,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="overflow-hidden flex flex-col"
                    >
                      <label
                        className="mb-[7px] block text-[12px] font-[500] text-text-secondary"
                        htmlFor="auth-username"
                      >
                        {t("login.label_username")}
                      </label>
                      <TextInput
                        id="auth-username"
                        autoFocus
                        type="text"
                        autoCapitalize="none"
                        spellCheck={false}
                        autoComplete="username"
                        placeholder={t("login.placeholder_username")}
                        value={username}
                        icon={
                          <span className="text-[14px] font-medium text-text-tertiary select-none">
                            @
                          </span>
                        }
                        hasError={Boolean(error)}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? "auth-form-error" : "auth-username-hint"}
                        onChange={(event) => {
                          setUsername(
                            event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                          );
                          if (error) setError("");
                        }}
                        disabled={submitting}
                      />
                      <span
                        id="auth-username-hint"
                        className="mt-1 text-[11px] text-text-tertiary"
                      >
                        {t("login.username_hint")}
                      </span>

                      <label
                        className="mb-[7px] mt-[14px] block text-[12px] font-[500] text-text-secondary"
                        htmlFor="auth-display-name"
                      >
                        {t("login.label_display_name")}
                      </label>
                      <TextInput
                        id="auth-display-name"
                        type="text"
                        autoComplete="name"
                        placeholder={t("login.placeholder_display_name")}
                        value={displayName}
                        hasError={Boolean(error)}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? "auth-form-error" : undefined}
                        onChange={(event) => {
                          setDisplayName(event.target.value);
                          if (error) setError("");
                        }}
                        disabled={submitting}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="min-h-[22px] py-[6px]">
                  <AnimatePresence mode="wait" initial={false}>
                    {error && (
                      <motion.p
                        key={error}
                        id="auth-form-error"
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

                {/* Submit / Action buttons */}
                <AnimatePresence initial={false}>
                  {mode === "login" ? (
                    <motion.div
                      key="login-footer"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{
                        duration: 0.18,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="overflow-hidden"
                    >
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="mt-[2px] w-full"
                      >
                        {submitting ? (
                          <>
                            <span className="h-[14px] w-[14px] animate-spin rounded-full border-2 border-current border-t-transparent" />
                            <span>{t("login.btn_signing_in")}</span>
                          </>
                        ) : (
                          t("login.btn_sign_in")
                        )}
                      </Button>
                    </motion.div>
                  ) : registerStep === 1 ? (
                    <motion.div
                      key="register-step1-footer"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{
                        duration: 0.18,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="overflow-hidden"
                    >
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="mt-[2px] w-full"
                      >
                        {t("login.btn_continue")}
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="register-step2-footer"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{
                        duration: 0.18,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="overflow-hidden"
                    >
                      <div className="mt-[2px] flex items-center gap-[10px]">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={submitting}
                          onClick={() => {
                            setError("");
                            setRegisterStep(1);
                          }}
                          className="w-[110px] shrink-0"
                        >
                          <ArrowLeftLine className="h-4 w-4" />
                          <span className="relative -left-[1.5px] top-[1px]">{t("login.btn_back")}</span>
                        </Button>
                        <Button
                          type="submit"
                          disabled={submitting}
                          className="flex-1"
                        >
                          {submitting ? (
                            <>
                              <span className="h-[14px] w-[14px] animate-spin rounded-full border-2 border-current border-t-transparent" />
                              <span>{t("login.btn_creating_account")}</span>
                            </>
                          ) : (
                            t("login.btn_create_account")
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </div>
          </div>

          {/* Bottom: legal warning */}
          <p className="m-0 shrink-0 text-center text-[11px] leading-[1.5] text-text-tertiary">
            {t("login.legal")}{" "}
            <a
              href="https://tryliner.fun/terms"
              target="_blank"
              rel="noreferrer"
              className="text-text-secondary underline underline-offset-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text-primary rounded-xs transition-colors"
            >
              {t("login.legal_tos")}
            </a>{" "}
            {t("login.legal_and")}{" "}
            <a
              href="https://tryliner.fun/privacy"
              target="_blank"
              rel="noreferrer"
              className="text-text-secondary underline underline-offset-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text-primary rounded-xs transition-colors"
            >
              {t("login.legal_pp")}
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
