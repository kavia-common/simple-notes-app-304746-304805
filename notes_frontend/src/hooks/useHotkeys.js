import { useEffect } from "react";

/**
 * Global keyboard shortcuts:
 * - Ctrl/Cmd+S: save
 * - Esc: clear selection
 */
// PUBLIC_INTERFACE
export function useHotkeys({ onSave, onEscape }) {
  useEffect(() => {
    const handler = (e) => {
      const key = e.key?.toLowerCase?.() ?? "";
      const isSave = (e.ctrlKey || e.metaKey) && key === "s";
      if (isSave) {
        e.preventDefault();
        onSave?.();
        return;
      }
      if (e.key === "Escape") {
        onEscape?.();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEscape, onSave]);
}
