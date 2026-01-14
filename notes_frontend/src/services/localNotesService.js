import { loadJson, saveJson } from "../utils/storage";

/**
 * NOTE SHAPE:
 * { id: string, title: string, body: string, createdAt: number, updatedAt: number }
 */
const STORAGE_KEY = "simple_notes_app__notes_v1";

function normalizeNote(raw) {
  const now = Date.now();
  return {
    id: String(raw.id),
    title: typeof raw.title === "string" ? raw.title : "",
    body: typeof raw.body === "string" ? raw.body : "",
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : now,
  };
}

function readAll() {
  const data = loadJson(STORAGE_KEY, []);
  if (!Array.isArray(data)) return [];
  return data.map(normalizeNote);
}

function writeAll(notes) {
  saveJson(STORAGE_KEY, notes);
}

function makeId() {
  return crypto?.randomUUID?.() ?? `n_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

// PUBLIC_INTERFACE
export function createLocalNotesService() {
  return {
    mode: "local",
    // PUBLIC_INTERFACE
    async listNotes() {
      return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
    },
    // PUBLIC_INTERFACE
    async createNote({ title, body }) {
      const now = Date.now();
      const note = {
        id: makeId(),
        title: typeof title === "string" ? title : "Untitled note",
        body: typeof body === "string" ? body : "",
        createdAt: now,
        updatedAt: now,
      };
      const all = readAll();
      writeAll([note, ...all]);
      return note;
    },
    // PUBLIC_INTERFACE
    async updateNote(id, { title, body }) {
      const all = readAll();
      const idx = all.findIndex((n) => n.id === id);
      if (idx === -1) {
        throw new Error("Note not found");
      }
      const now = Date.now();
      const updated = {
        ...all[idx],
        title: typeof title === "string" ? title : all[idx].title,
        body: typeof body === "string" ? body : all[idx].body,
        updatedAt: now,
      };
      const next = [...all];
      next[idx] = updated;
      writeAll(next);
      return updated;
    },
    // PUBLIC_INTERFACE
    async deleteNote(id) {
      const all = readAll();
      writeAll(all.filter((n) => n.id !== id));
      return true;
    },
  };
}
