import { useEffect, useState } from "react";

function isActive(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

export function useWindowActive(): boolean {
  const [active, setActive] = useState(isActive);

  useEffect(() => {
    const update = () => setActive(isActive());
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
    };
  }, []);

  return active;
}
