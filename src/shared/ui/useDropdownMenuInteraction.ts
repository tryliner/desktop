import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type RefObject,
} from "react";

interface DropdownMenuInteractionOptions {
  open: boolean;
  isFixed: boolean;
  setOpen: (open: boolean) => void;
  containerRef: RefObject<HTMLDivElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
}

export function useDropdownMenuInteraction({
  open,
  isFixed,
  setOpen,
  containerRef,
  menuRef,
}: DropdownMenuInteractionOptions) {
  const keyboardOpenRef = useRef(false);
  const focusMenuItem = useCallback(() => {
    const selected = menuRef.current?.querySelector<HTMLButtonElement>(
      "button[aria-current='true']:not(:disabled)",
    );
    const first = menuRef.current?.querySelector<HTMLButtonElement>(
      "button:not(:disabled)",
    );
    (selected ?? first)?.focus();
  }, [menuRef]);
  useLayoutEffect(() => {
    if (open && keyboardOpenRef.current) {
      focusMenuItem();
    }
  }, [open, isFixed, focusMenuItem]);
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        menuRef.current?.contains(e.target as Node) ||
        containerRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        keyboardOpenRef.current = false;
        containerRef.current
          ?.querySelector<HTMLButtonElement>("button")
          ?.focus();
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen, containerRef, menuRef]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const buttons = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ) ?? [],
    );
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (index + (event.key === "ArrowUp" ? -1 : 1) + buttons.length) %
            buttons.length;
    buttons[next]?.focus();
  };
  const onTriggerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    keyboardOpenRef.current = true;
    if (open) focusMenuItem();
    else setOpen(true);
  };
  const closeAndFocus = () => {
    keyboardOpenRef.current = false;
    setOpen(false);
    containerRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  };
  return { keyboardOpenRef, onMenuKeyDown, onTriggerKeyDown, closeAndFocus };
}
