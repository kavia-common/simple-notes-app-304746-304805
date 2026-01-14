import { normalizeNote, nowTs, sortNotesByUpdatedAtDesc } from "../utils/note";

function joinUrl(base, path) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  return `${b}/${p}`;
}

async function httpJson(url, options) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }

  // Allow empty responses
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  return res.json();
}

/**
 * Assumes a minimal REST API, e.g.:
 * GET    /notes
 * GET    /notes/:id
 * POST   /notes           {title, body}
 * PUT    /notes/:id       {title, body}
 * DELETE /notes/:id
 *
 * Returned notes may vary; we normalize into:
 * {id, title, body, createdAt, updatedAt}
 */
// PUBLIC_INTERFACE
export function createRestNotesService(baseUrl) {
  return {
    mode: "api",
    baseUrl,

    // PUBLIC_INTERFACE
    async listNotes() {
      const data = await httpJson(joinUrl(baseUrl, "/notes"), { method: "GET" });
      const now = nowTs();
      const normalized = (Array.isArray(data) ? data : []).map((n) =>
        normalizeNote(n, { now })
      );
      return sortNotesByUpdatedAtDesc(normalized);
    },

    // PUBLIC_INTERFACE
    async getNote(id) {
      const data = await httpJson(joinUrl(baseUrl, `/notes/${encodeURIComponent(id)}`), {
        method: "GET",
      });
      // Even if API returns null or partials, normalize into stable shape (or null)
      if (!data) return null;
      return normalizeNote(data, { now: nowTs() });
    },

    // PUBLIC_INTERFACE
    async createNote({ title, body }) {
      const now = nowTs();
      const data = await httpJson(joinUrl(baseUrl, "/notes"), {
        method: "POST",
        body: JSON.stringify({ title, body }),
      });

      // If backend doesn't return createdAt/updatedAt, fill them.
      return normalizeNote(
        {
          title: typeof title === "string" ? title : "",
          body: typeof body === "string" ? body : "",
          ...(data && typeof data === "object" ? data : {}),
          createdAt: (data && data.createdAt) ?? now,
          updatedAt: (data && data.updatedAt) ?? now,
        },
        { now }
      );
    },

    // PUBLIC_INTERFACE
    async updateNote(id, { title, body }) {
      const now = nowTs();
      const data = await httpJson(joinUrl(baseUrl, `/notes/${encodeURIComponent(id)}`), {
        method: "PUT",
        body: JSON.stringify({ title, body }),
      });

      // If backend response omits fields, use request data and timestamps.
      return normalizeNote(
        {
          id,
          title: typeof title === "string" ? title : "",
          body: typeof body === "string" ? body : "",
          ...(data && typeof data === "object" ? data : {}),
          updatedAt: (data && data.updatedAt) ?? now,
        },
        { now }
      );
    },

    // PUBLIC_INTERFACE
    async deleteNote(id) {
      await httpJson(joinUrl(baseUrl, `/notes/${encodeURIComponent(id)}`), {
        method: "DELETE",
      });
      return true;
    },
  };
}
