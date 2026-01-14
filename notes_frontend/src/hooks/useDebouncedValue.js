import { useEffect, useState } from "react";

/**
 * Debounces a value by a given delay.
 * Useful for search boxes and other high-frequency inputs to reduce renders/work.
 */
// PUBLIC_INTERFACE
export function useDebouncedValue(value, delayMs) {
  /** Returns a debounced version of `value` that updates after `delayMs`. */
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
