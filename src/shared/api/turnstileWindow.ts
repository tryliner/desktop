export type TurnstileAction = "login" | "register";

export class TurnstileCancelledError extends Error {
  constructor(message = "The human check was closed.") {
    super(message);
    this.name = "TurnstileCancelledError";
  }
}

interface TurnstileMessage {
  source?: string;
  action?: string;
  type?: "token" | "error" | "expired";
  token?: string;
  code?: string;
}

const FRAME_WIDTH = 320;
const FRAME_HEIGHT = 84;

function overlay(): { root: HTMLDivElement; card: HTMLDivElement; cancel: HTMLButtonElement; status: HTMLParagraphElement } {
  const root = document.createElement("div");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Human check");
  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(9, 9, 11, 0.72)",
  });
  const card = document.createElement("div");
  Object.assign(card.style, {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "14px",
    padding: "22px 24px 18px",
    borderRadius: "14px",
    background: "#18181b",
    color: "#e4e4e7",
    font: "500 14px/1.4 system-ui, sans-serif",
    boxShadow: "0 18px 48px rgba(0, 0, 0, 0.45)",
  });
  const title = document.createElement("p");
  title.textContent = "Quick check before you continue";
  Object.assign(title.style, { margin: "0" });
  const status = document.createElement("p");
  Object.assign(status.style, { margin: "0", minHeight: "18px", color: "#a1a1aa", fontWeight: "400", fontSize: "12px" });
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  Object.assign(cancel.style, {
    border: "0",
    borderRadius: "8px",
    padding: "7px 14px",
    background: "#27272a",
    color: "#e4e4e7",
    font: "500 13px system-ui, sans-serif",
    cursor: "pointer",
  });
  card.append(title);
  root.append(card);
  return { root, card, cancel, status };
}

export function requestTurnstileToken(apiBaseUrl: string, action: TurnstileAction): Promise<string> {
  return new Promise((resolve, reject) => {
    const origin = new URL(apiBaseUrl).origin;
    const { root, card, cancel, status } = overlay();
    const frame = document.createElement("iframe");
    frame.src = `${apiBaseUrl.replace(/\/+$/, "")}/v1/auth/verify?action=${action}`;
    frame.title = "Human check";
    frame.width = String(FRAME_WIDTH);
    frame.height = String(FRAME_HEIGHT);
    Object.assign(frame.style, { border: "0", background: "transparent", colorScheme: "dark" });
    card.append(frame, status, cancel);

    const finish = () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", onKey);
      root.remove();
    };
    const onMessage = (event: MessageEvent<TurnstileMessage>) => {
      if (event.origin !== origin || event.source !== frame.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== "liner-turnstile" || data.action !== action) return;
      if (data.type === "token" && data.token) {
        finish();
        resolve(data.token);
      } else if (data.type === "expired") {
        status.textContent = "The check expired, it will refresh.";
      } else if (data.type === "error") {
        status.textContent = "The check could not load. Check your connection and try again.";
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      finish();
      reject(new TurnstileCancelledError());
    };
    cancel.addEventListener("click", () => {
      finish();
      reject(new TurnstileCancelledError());
    });
    window.addEventListener("message", onMessage);
    window.addEventListener("keydown", onKey);
    document.body.append(root);
  });
}
