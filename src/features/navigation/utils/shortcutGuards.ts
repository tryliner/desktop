const TEXT_ENTRY_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

const SPACE_CONSUMING_ROLES = new Set([
  "switch",
  "checkbox",
  "radio",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "tab",
  "option",
]);

const ARROW_CONSUMING_ROLES = new Set([
  "slider",
  "spinbutton",
  "listbox",
  "combobox",
  "option",
  "menu",
  "menuitem",
  "tablist",
  "tab",
]);

const ARROW_CODES = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return TEXT_ENTRY_TAGS.has(target.tagName);
}

export function hasBlockingModifier(
  event: Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey">,
): boolean {
  return event.ctrlKey || event.metaKey || event.altKey;
}

export function isBlockingOverlayOpen(): boolean {
  return Boolean(
    document.querySelector("[data-dialog-container], [data-dropdown-menu]"),
  );
}

export function isKeyHandledByFocusedControl(
  target: EventTarget | null,
  code: string,
): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const role = target.getAttribute("role");

  if (code === "Space") {
    if (target.tagName === "SELECT") return true;
    return role !== null && SPACE_CONSUMING_ROLES.has(role);
  }

  if (ARROW_CODES.has(code)) {
    if (target.tagName === "SELECT") return true;
    if (target.tagName === "INPUT" && (target as HTMLInputElement).type === "range") return true;
    return role !== null && ARROW_CONSUMING_ROLES.has(role);
  }

  return false;
}
