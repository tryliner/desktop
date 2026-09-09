import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act } from "react";
import LoginPage from "./LoginPage";

const mockNavigate = vi.fn();
const mockLogin = vi.fn();
const mockRegister = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: {
    div: ({ children, className, style, ...props }: any) => (
      <div className={className} style={style} {...props}>
        {children}
      </div>
    ),
    p: ({ children, className, style, ...props }: any) => (
      <p className={className} style={style} {...props}>
        {children}
      </p>
    ),
  },
}));

vi.mock("../store/authStore", () => ({
  useAuthStore: (selector: any) =>
    selector({
      login: mockLogin,
      register: mockRegister,
      status: "anonymous",
      user: null,
    }),
  getAuthErrorCode: (err: any) => (err?.code ? err.code.toLowerCase() : "server_unavailable"),
  authErrorMessage: (err: any) => err?.message || "An error occurred",
}));

vi.mock("@/languages", () => {
  const translations: Record<string, string> = {
    "login.auth_title_login": "Your music, your way",
    "login.auth_subtitle_login": "Sign in and pick up right where you left off.",
    "login.auth_title_register": "Join Liner",
    "login.auth_subtitle_register": "Create an account and start building your personal library.",
    "login.profile_setup_title": "Set up your profile",
    "login.profile_setup_subtitle": "Choose your unique handle and display name.",
    "login.step_indicator": "Step {step} of {total}",
    "login.btn_continue": "Continue",
    "login.btn_back": "Back",
    "login.label_email": "Email",
    "login.label_username": "Username (@handle)",
    "login.placeholder_username": "soundwave",
    "login.label_display_name": "Display Name",
    "login.placeholder_display_name": "Your name or alias",
    "login.label_password": "Password",
    "login.label_confirm_password": "Confirm password",
    "login.placeholder_email": "you@example.com",
    "login.placeholder_password": "Your password",
    "login.placeholder_password_new": "At least 8 characters",
    "login.placeholder_confirm": "Repeat your password",
    "login.btn_sign_in": "Sign in",
    "login.btn_signing_in": "Signing in…",
    "login.btn_create_account": "Create account",
    "login.btn_creating_account": "Creating account…",
    "login.separator_or": "or",
    "login.have_account": "Already have an account?",
    "login.have_account_action": "Sign in",
    "login.legal": "By continuing, you agree to the",
    "login.legal_tos": "Terms of Service",
    "login.legal_and": "and",
    "login.legal_pp": "Privacy Policy",
    "login.errors.email_invalid": "Enter a valid email address.",
    "login.errors.password_min_8": "Password must contain at least 8 characters.",
    "login.errors.password_mismatch": "Passwords do not match.",
    "login.errors.username_invalid": "Username must be 3-30 lowercase letters, numbers, or underscores.",
    "login.errors.username_taken": "This username is already taken. Please choose another.",
    "login.errors.display_name_required": "Display name is required.",
    "login.username_hint": "3-30 lowercase characters, numbers or underscores.",
  };

  return {
    useTranslation: () => ({
      locale: "en",
      setLocale: vi.fn(),
      t: (key: string, params?: Record<string, any>) => {
        let str = translations[key] || key;
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            str = str.replace(`{${k}}`, String(v));
          });
        }
        return str;
      },
    }),
  };
});

vi.mock("@/shared/ui/CircleDitherCanvas", () => ({
  default: () => <div data-testid="dither-canvas" />,
}));

vi.mock("@/features/navigation/ui/WindowControls", () => ({
  default: () => <div data-testid="window-controls" />,
}));

vi.mock("react-apple-emojis", () => ({
  Emoji: () => <span data-testid="emoji" />,
}));

describe("LoginPage Multi-Step Registration Flow", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it("renders in Login mode by default", async () => {
    await act(async () => {
      root.render(<LoginPage />);
    });

    expect(container.querySelector("#auth-email")).not.toBeNull();
    expect(container.querySelector("#auth-password")).not.toBeNull();
    expect(container.querySelector("#auth-confirm")).toBeNull();
    expect(container.querySelector("#auth-username")).toBeNull();

    const buttons = Array.from(container.querySelectorAll("button"));
    const createAccBtn = buttons.find((b) => b.textContent?.includes("Create account"));
    expect(createAccBtn).toBeDefined();
  });

  it("switches to Register Step 1 when clicking Create Account", async () => {
    await act(async () => {
      root.render(<LoginPage />);
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const createAccBtn = buttons.find((b) => b.textContent?.includes("Create account"));

    await act(async () => {
      createAccBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Step 1 of 2");
    expect(container.querySelector("#auth-email")).not.toBeNull();
    expect(container.querySelector("#auth-password")).not.toBeNull();
    expect(container.querySelector("#auth-confirm")).not.toBeNull();
    expect(container.querySelector("#auth-username")).toBeNull();
  });

  it("validates Step 1 credentials before advancing to Step 2", async () => {
    await act(async () => {
      root.render(<LoginPage />);
    });

    // Go to register mode
    const createAccBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Create account"),
    );
    await act(async () => {
      createAccBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Try to continue with empty email
    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.querySelector("#auth-form-error")?.textContent).toContain(
      "Enter a valid email address",
    );
    expect(container.textContent).toContain("Step 1 of 2");

    // Enter valid email and mismatched passwords
    const emailInput = container.querySelector("#auth-email") as HTMLInputElement;
    const passInput = container.querySelector("#auth-password") as HTMLInputElement;
    const confirmInput = container.querySelector("#auth-confirm") as HTMLInputElement;

    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      nativeInputValueSetter?.call(emailInput, "alice@example.com");
      emailInput.dispatchEvent(new Event("input", { bubbles: true }));
      nativeInputValueSetter?.call(passInput, "password123");
      passInput.dispatchEvent(new Event("input", { bubbles: true }));
      nativeInputValueSetter?.call(confirmInput, "mismatchedpass");
      confirmInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.querySelector("#auth-form-error")?.textContent).toContain(
      "Passwords do not match",
    );
    expect(container.textContent).toContain("Step 1 of 2");

    // Fix confirm password and submit Step 1
    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      nativeInputValueSetter?.call(confirmInput, "password123");
      confirmInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    // Successfully transitioned to Step 2!
    expect(container.textContent).toContain("Step 2 of 2");
    expect(container.textContent).toContain("Set up your profile");
    expect(container.querySelector("#auth-username")).not.toBeNull();
    expect(container.querySelector("#auth-display-name")).not.toBeNull();
  });

  it("navigates back to Step 1 when Back button is clicked", async () => {
    await act(async () => {
      root.render(<LoginPage />);
    });

    // Go to register mode
    const createAccBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Create account"),
    );
    await act(async () => {
      createAccBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Fill valid credentials
    const emailInput = container.querySelector("#auth-email") as HTMLInputElement;
    const passInput = container.querySelector("#auth-password") as HTMLInputElement;
    const confirmInput = container.querySelector("#auth-confirm") as HTMLInputElement;

    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      nativeInputValueSetter?.call(emailInput, "bob@example.com");
      emailInput.dispatchEvent(new Event("input", { bubbles: true }));
      nativeInputValueSetter?.call(passInput, "securepassword");
      passInput.dispatchEvent(new Event("input", { bubbles: true }));
      nativeInputValueSetter?.call(confirmInput, "securepassword");
      confirmInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain("Step 2 of 2");

    // Click Back
    const backBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Back"),
    );
    await act(async () => {
      backBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Step 1 of 2");
    expect((container.querySelector("#auth-email") as HTMLInputElement)?.value).toBe(
      "bob@example.com",
    );
  });

  it("submits registration on Step 2", async () => {
    mockRegister.mockResolvedValueOnce({
      user: { id: "1", email: "carol@example.com", username: "carol_sound", displayName: "Carol" },
    });

    await act(async () => {
      root.render(<LoginPage />);
    });

    // Register mode
    const createAccBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Create account"),
    );
    await act(async () => {
      createAccBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Credentials
    const emailInput = container.querySelector("#auth-email") as HTMLInputElement;
    const passInput = container.querySelector("#auth-password") as HTMLInputElement;
    const confirmInput = container.querySelector("#auth-confirm") as HTMLInputElement;

    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      nativeInputValueSetter?.call(emailInput, "carol@example.com");
      emailInput.dispatchEvent(new Event("input", { bubbles: true }));
      nativeInputValueSetter?.call(passInput, "password123");
      passInput.dispatchEvent(new Event("input", { bubbles: true }));
      nativeInputValueSetter?.call(confirmInput, "password123");
      confirmInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    // Step 2 inputs
    const usernameInput = container.querySelector("#auth-username") as HTMLInputElement;
    const displayNameInput = container.querySelector("#auth-display-name") as HTMLInputElement;

    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      nativeInputValueSetter?.call(usernameInput, "carol_sound");
      usernameInput.dispatchEvent(new Event("input", { bubbles: true }));
      nativeInputValueSetter?.call(displayNameInput, "Carol Music");
      displayNameInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mockRegister).toHaveBeenCalledWith(
      "carol@example.com",
      "password123",
      "carol_sound",
      "Carol Music",
    );
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });
});
