import { useMemo } from "react";
import { createLocalNotesService } from "../services/localNotesService";
import { createRestNotesService } from "../services/restNotesService";
import { normalizeNote, sortNotesByUpdatedAtDesc } from "../utils/note";

/**
 * Selects which notes service to use.
 * Defaults to localStorage, switches to REST if REACT_APP_API_BASE or REACT_APP_BACKEND_URL is configured.
 *
 * Also applies a thin normalization wrapper to ensure the UI always receives the canonical Note shape.
 */
// PUBLIC_INTERFACE
export function useNotesService() {
  const baseUrl =
    process.env.REACT_APP_API_BASE ||
    process.env.REACT_APP_BACKEND_URL ||
    "";

  return useMemo(() => {
    const trimmed = String(baseUrl || "").trim();
    const svc = trimmed ? createRestNotesService(trimmed) : createLocalNotesService();

    // Defensive wrapper: guarantees canonical shape even if an underlying service changes.
    return {
      ...svc,
      // PUBLIC_INTERFACE
      async listNotes() {
        const list = await svc.listNotes();
        const normalized = (Array.isArray(list) ? list : []).map((n) => normalizeNote(n));
        return sortNotesByUpdatedAtDesc(normalized);
      },
      // PUBLIC_INTERFACE
      async getNote(id) {
        if (typeof svc.getNote !== "function") return null;
        const note = await svc.getNote(id);
        return note ? normalizeNote(note) : null;
      },
      // PUBLIC_INTERFACE
      async createNote(payload) {
        const created = await svc.createNote(payload);
        return created ? normalizeNote(created) : normalizeNote({ id: "", title: "", body: "" });
      },
      // PUBLIC_INTERFACE
      async updateNote(id, payload) {
        const updated = await svc.updateNote(id, payload);
        return updated ? normalizeNote(updated) : normalizeNote({ id: String(id), ...payload });
      },
      // PUBLIC_INTERFACE
      async deleteNote(id) {
        return svc.deleteNote(id);
      },
    };
  }, [baseUrl]);
}
