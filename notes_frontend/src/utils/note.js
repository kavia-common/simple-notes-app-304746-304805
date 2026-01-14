/**
 * Note normalization helpers.
 *
 * Contract: { id: string, title: string, body: string, createdAt: number, updatedAt: number }
 */

// PUBLIC_INTERFACE
export function nowTs() {
  /** Returns a unix epoch timestamp in milliseconds. */
  return Date.now();
}

function coerceTs(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  return fallback;
}

/**
 * Best-effort id coercion:
 * - prefer raw.id
 * - else raw._id (common in some APIs)
 * - else generate a stable-ish fallback to avoid crashing the UI
 */
function coerceId(raw, fallbackNow) {
  const candidate = raw?.id ?? raw?._id;
  if (typeof candidate === "string" && candidate.trim()) return candidate;
  if (typeof candidate === "number" && Number.isFinite(candidate)) return String(candidate);
  return `n_${fallbackNow}_${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Normalizes REST/local notes into the canonical shape.
 * - Fills missing fields with safe defaults
 * - Ensures timestamps are numbers
 * - Ensures id/title/body are strings
 */
// PUBLIC_INTERFACE
export function normalizeNote(raw, opts = {}) {
  /** Normalize a note-like object to the canonical Note shape. */
  const fallbackNow = typeof opts.now === "number" ? opts.now : nowTs();

  // Guard against null/primitive responses
  const obj = raw && typeof raw === "object" ? raw : {};

  const createdAt = coerceTs(obj.createdAt, fallbackNow);
  const updatedAt = coerceTs(obj.updatedAt, createdAt);

  return {
    id: coerceId(obj, fallbackNow),
    title: typeof obj.title === "string" ? obj.title : "",
    body: typeof obj.body === "string" ? obj.body : "",
    createdAt,
    updatedAt,
  };
}

// PUBLIC_INTERFACE
export function sortNotesByUpdatedAtDesc(notes) {
  /** Sorts notes by updatedAt descending (most recently updated first). */
  return [...(Array.isArray(notes) ? notes : [])].sort(
    (a, b) => (b?.updatedAt ?? 0) - (a?.updatedAt ?? 0)
  );
}
