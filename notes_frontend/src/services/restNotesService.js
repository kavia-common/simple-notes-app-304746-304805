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
 * POST   /notes           {title, body}
 * PUT    /notes/:id       {title, body}
 * DELETE /notes/:id
 *
 * Returned notes should include {id, title, body, createdAt, updatedAt}.
 */
// PUBLIC_INTERFACE
export function createRestNotesService(baseUrl) {
  return {
    mode: "api",
    baseUrl,
    // PUBLIC_INTERFACE
    async listNotes() {
      const data = await httpJson(joinUrl(baseUrl, "/notes"), { method: "GET" });
      return Array.isArray(data) ? data : [];
    },
    // PUBLIC_INTERFACE
    async createNote({ title, body }) {
      const data = await httpJson(joinUrl(baseUrl, "/notes"), {
        method: "POST",
        body: JSON.stringify({ title, body }),
      });
      return data;
    },
    // PUBLIC_INTERFACE
    async updateNote(id, { title, body }) {
      const data = await httpJson(joinUrl(baseUrl, `/notes/${encodeURIComponent(id)}`), {
        method: "PUT",
        body: JSON.stringify({ title, body }),
      });
      return data;
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
