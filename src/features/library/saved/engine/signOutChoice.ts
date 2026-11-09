export type SignOutChoice = "ask" | "remove" | "keep";

export const SIGN_OUT_CHOICES: readonly SignOutChoice[] = [
  "ask",
  "remove",
  "keep",
];

export function parseSignOutChoice(value: string | null): SignOutChoice {
  return SIGN_OUT_CHOICES.find((choice) => choice === value) ?? "ask";
}

export function shouldAskBeforeSignOut(state: {
  signOutChoice: SignOutChoice;
  records: readonly unknown[];
}): boolean {
  return state.signOutChoice === "ask" && state.records.length > 0;
}

export function resolveKeepOnSignOut(
  choice: SignOutChoice,
  answer: boolean | null,
): boolean {
  if (answer !== null) return answer;
  return choice === "keep";
}
