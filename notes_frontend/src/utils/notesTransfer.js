import { normalizeNote } from "./note";

/**
 * Export/import helpers for notes.
 * Keeps the canonical shape by using normalizeNote(), and uses updatedAt to resolve conflicts.
 */

function safeParseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function isPlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function coerceArrayOfNotes(payload) {
  // Accept either:
  // 1) an array of note-like objects
  // 2) an object like { notes: [...] }
  if (Array.isArray(payload)) return payload;
  if (isPlainObject(payload) && Array.isArray(payload.notes)) return payload.notes;
  return null;
}

// PUBLIC_INTERFACE
export async function parseNotesImportFile(file) {
  /** Parses a JSON file and returns an array of normalized notes, or throws a descriptive Error. */
  if (!file) throw new Error("No file provided.");
  const text = await file.text();
  const parsed = safeParseJson(text);
  if (!parsed.ok) throw new Error("Invalid JSON file.");

  const arr = coerceArrayOfNotes(parsed.value);
  if (!arr) throw new Error("JSON must be an array of notes, or an object with a `notes` array.");

  const normalized = arr.map((n) => normalizeNote(n));
  return normalized;
}

// PUBLIC_INTERFACE
export function mergeNotesById(existingNotes, importedNotes) {
  /**
   * Merges notes by id:
   * - If id missing in existing -> add
   * - If id exists -> keep the note with newer updatedAt (import wins when newer)
   * Returns { merged, stats }.
   */
  const base = Array.isArray(existingNotes) ? existingNotes : [];
  const incoming = Array.isArray(importedNotes) ? importedNotes : [];

  const map = new Map(base.map((n) => [String(n.id), n]));
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of incoming) {
    const n = normalizeNote(raw);
    const id = String(n.id);
    const cur = map.get(id);

    if (!cur) {
      map.set(id, n);
      added += 1;
      continue;
    }

    const curUpdated = typeof cur.updatedAt === "number" ? cur.updatedAt : 0;
    const nextUpdated = typeof n.updatedAt === "number" ? n.updatedAt : 0;

    if (nextUpdated > curUpdated) {
      map.set(id, n);
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    merged: Array.from(map.values()),
    stats: { added, updated, skipped, imported: incoming.length, existing: base.length },
  };
}

// PUBLIC_INTERFACE
export function downloadNotesJson(notes, filenameBase = "simple-notes") {
  /** Triggers a browser download of notes as pretty-printed JSON. */
  const safeNotes = Array.isArray(notes) ? notes.map((n) => normalizeNote(n)) : [];
  const payload = {
    version: 1,
    exportedAt: Date.now(),
    notes: safeNotes,
  };
  const json = JSON.stringify(payload, null, 2);

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${filenameBase}-${stamp}.json`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Cleanup
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
