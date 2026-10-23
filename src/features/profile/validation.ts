import type { ProfileValidationResult } from "./types";

export const HANDLE_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
export const BIO_MAX_LENGTH = 250;
export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 30;

export interface ValidateProfileInput {
  handle?: string | null;
  username?: string | null;
  bio?: string | null;
  displayName?: string | null;
}

export function validateProfile(input: ValidateProfileInput): ProfileValidationResult {
  const errors: string[] = [];
  const fieldErrors: { handle?: string; bio?: string; displayName?: string } = {};

  const rawHandle = input.handle !== undefined ? input.handle : input.username;
  const handle = (rawHandle ?? "").trim();

  if (!handle || handle.length < HANDLE_MIN_LENGTH) {
    errors.push("Handle must be at least 3 characters");
    errors.push("Handle length invalid");
    fieldErrors.handle = "Handle must be at least 3 characters";
  } else if (handle.length > HANDLE_MAX_LENGTH) {
    errors.push("Handle length invalid");
    fieldErrors.handle = "Handle length invalid";
  } else if (!/^[a-zA-Z0-9_]+$/.test(handle)) {
    errors.push("Handle can only contain alphanumeric and underscore");
    fieldErrors.handle = "Handle can only contain alphanumeric and underscore";
  }

  if (input.bio && input.bio.length > BIO_MAX_LENGTH) {
    errors.push("Bio cannot exceed 250 characters");
    errors.push("Bio too long");
    fieldErrors.bio = "Bio cannot exceed 250 characters";
  }

  return {
    valid: errors.length === 0,
    errors,
    fieldErrors,
  };
}

export function sanitizeBio(rawBio: string): string {
  if (!rawBio) return "";
  return rawBio.replace(/<[^>]*>?/gm, "").trim();
}
