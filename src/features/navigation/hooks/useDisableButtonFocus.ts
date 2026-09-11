import { useEffect } from "react";

function isButtonElement(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false;
  if (target.tagName === "BUTTON") return true;
  return target.getAttribute("role") === "button";
}

export function useDisableButtonFocus(): void {
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      if (isButtonElement(event.target)) {
        (event.target as HTMLElement).blur();
      }
    };

    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);
}
