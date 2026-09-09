import { create } from "zustand";
import { api, ApiError } from "@/shared/api";
import {
  clearAuthSession,
  getAuthSession,
  setAuthSession,
  type AuthUser,
  type PublicUser,
  type UpdateProfileInput,
} from "@/shared/api";

export type AuthStatus = "initializing" | "authenticated" | "anonymous";
export type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    username: string,
    displayName: string,
  ) => Promise<void>;
  updateProfile: (patch: UpdateProfileInput) => Promise<PublicUser>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: "initializing",
  user: null,
  initialize: async () => {
    const stored = getAuthSession();
    if (!stored) {
      set({ status: "anonymous", user: null });
      return;
    }
    // Optimistically authenticate if stored user is present
    if (stored.user) {
      set({ status: "authenticated", user: stored.user });
    }
    try {
      const getMePromise = api.getMe();
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Auth initialize timeout")), 6000),
      );
      const user = await Promise.race([getMePromise, timeoutPromise]);
      const current = getAuthSession();
      if (current) setAuthSession({ ...current, user: user ?? current.user });
      set({ status: "authenticated", user: user ?? current?.user ?? stored.user });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setAuthSession(null);
        set({ status: "anonymous", user: null });
      } else {
        // If it's a network error, timeout, or transient 5xx, preserve authenticated state if we have a stored session
        if (stored.user || stored.accessToken) {
          set({ status: "authenticated", user: stored.user });
        } else {
          setAuthSession(null);
          set({ status: "anonymous", user: null });
        }
      }
    }
  },
  login: async (email, password) => {
    const result = await api.login(email, password);
    set({ status: "authenticated", user: result.user });
  },
  register: async (email, password, username, displayName) => {
    const result = await api.register(email, password, username, displayName);
    set({ status: "authenticated", user: result.user });
  },
  updateProfile: async (patch) => {
    const updated = await api.updateProfile(patch);
    const current = getAuthSession();
    if (current) {
      setAuthSession({ ...current, user: { ...current.user, ...updated } });
    }
    set((prev) => ({
      user: prev.user ? { ...prev.user, ...updated } : updated,
    }));
    return updated;
  },
  logout: async () => {
    await clearAuthSession();
    set({ status: "anonymous", user: null });
  },
}));

export function getAuthErrorCode(error: unknown): string {
  if (!(error instanceof ApiError)) return "server_unavailable";
  if (error.code === "INVALID_CREDENTIALS") return "invalid_credentials";
  if (error.code === "EMAIL_ALREADY_USED") return "email_already_used";
  if (error.code === "USERNAME_TAKEN") return "username_taken";
  if (error.code === "INVALID_USERNAME") return "invalid_username";
  if (error.code === "INVALID_INPUT") return "invalid_input";
  return error.message;
}

export function authErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "Unable to reach the server.";
  if (error.code === "INVALID_CREDENTIALS")
    return "Email or password is incorrect.";
  if (error.code === "EMAIL_ALREADY_USED")
    return "This email is already in use.";
  if (error.code === "USERNAME_TAKEN")
    return "This username is already taken. Please choose another.";
  if (error.code === "INVALID_USERNAME")
    return "Username must be 3-30 lowercase characters (a-z, 0-9, _).";
  return error.message;
}
