import { loadJson, saveJson } from "../utils/storage";
import { normalizeNote, nowTs, sortNotesByUpdatedAtDesc } from "../utils/note";

/**
 * NOTE SHAPE (canonical):
 * { id: string, title: string, body: string, createdAt: number, updatedAt: number }
 */
const STORAGE_KEY = "simple_notes_app__notes_v1";

function readAll() {
  const data = loadJson(STORAGE_KEY, []);
  if (!Array.isArray(data)) return [];
  // Always normalize when reading from storage to keep the domain contract stable.
  return data.map((n) => normalizeNote(n));
}

function writeAll(notes) {
  // Persist canonical shape.
  saveJson(STORAGE_KEY, Array.isArray(notes) ? notes.map((n) => normalizeNote(n)) : []);
}

function makeId() {
  return crypto?.randomUUID?.() ?? `n_${nowTs()}_${Math.floor(Math.random() * 1e6)}`;
}

// PUBLIC_INTERFACE
export function createLocalNotesService() {
  return {
    mode: "local",

    // PUBLIC_INTERFACE
    async listNotes() {
      return sortNotesByUpdatedAtDesc(readAll());
    },

    // PUBLIC_INTERFACE
    async getNote(id) {
      const all = readAll();
      const found = all.find((n) => n.id === String(id));
      return found ? normalizeNote(found) : null;
    },

    // PUBLIC_INTERFACE
    async createNote({ title, body }) {
      const now = nowTs();
      const note = normalizeNote({
        id: makeId(),
        title: typeof title === "string" ? title : "Untitled note",
        body: typeof body === "string" ? body : "",
        createdAt: now,
        updatedAt: now,
      });

      const all = readAll();
      writeAll([note, ...all]);
      return note;
    },

    // PUBLIC_INTERFACE
    async updateNote(id, { title, body }) {
      const noteId = String(id);
      const all = readAll();
      const idx = all.findIndex((n) => n.id === noteId);
      if (idx === -1) {
        throw new Error("Note not found");
      }

      const now = nowTs();
      const updated = normalizeNote({
        ...all[idx],
        title: typeof title === "string" ? title : all[idx].title,
        body: typeof body === "string" ? body : all[idx].body,
        updatedAt: now,
      });

      const next = [...all];
      next[idx] = updated;
      writeAll(next);
      return updated;
    },

    // PUBLIC_INTERFACE
    async deleteNote(id) {
      const noteId = String(id);
      const all = readAll();
      writeAll(all.filter((n) => n.id !== noteId));
      return true;
    },
  };
}
