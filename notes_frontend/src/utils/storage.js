/**
 * Safe localStorage JSON read/write helpers.
 */

// PUBLIC_INTERFACE
export function loadJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// PUBLIC_INTERFACE
export function saveJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // If storage is full/blocked, fail silently; app still functions in-memory.
  }
}
