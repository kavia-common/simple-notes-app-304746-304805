import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Editor from "./components/Editor";
import ToastViewport from "./components/ToastViewport";
import { useNotesService } from "./hooks/useNotesService";
import { useHotkeys } from "./hooks/useHotkeys";
import { formatRelativeTime } from "./utils/date";

/**
 * Notes app shell: sidebar list + main editor, with autosave and toasts.
 * Persists to localStorage by default, or uses REST if REACT_APP_API_BASE / REACT_APP_BACKEND_URL is set.
 *
 * Validated flows:
 * - Create/select/edit/autosave/manual save/delete/search + empty states.
 * - Robustness improvements added for async errors and autosave race conditions.
 */
// PUBLIC_INTERFACE
function App() {
  const notesService = useNotesService();

  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [toasts, setToasts] = useState([]);

  // Draft state for editor
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const autosaveTimerRef = useRef(null);

  // Tracks the note id that the current autosave timer was scheduled for.
  // Prevents a stale timer from saving to the wrong note after selection changes.
  const autosaveNoteIdRef = useRef(null);

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedId) || null,
    [notes, selectedId]
  );

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return list;
    return list.filter((n) => {
      const t = (n.title || "").toLowerCase();
      const b = (n.body || "").toLowerCase();
      return t.includes(q) || b.includes(q);
    });
  }, [notes, query]);

  const pushToast = (toast) => {
    const id = crypto?.randomUUID?.() ?? String(Date.now() + Math.random());
    const t = { id, ...toast };
    setToasts((prev) => [...prev, t]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, toast.durationMs ?? 2200);
  };

  const loadNotes = async () => {
    try {
      const list = await notesService.listNotes();
      setNotes(Array.isArray(list) ? list : []);
      // Keep selection stable if possible
      if (selectedId && !list.some((n) => n.id === selectedId)) {
        setSelectedId(null);
      }
    } catch (e) {
      pushToast({
        kind: "danger",
        title: "Load failed",
        message: e?.message || "Could not load notes.",
      });
      setNotes([]);
      setSelectedId(null);
    }
  };

  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesService]);

  // When selection changes, cancel any pending autosave and sync draft from note.
  useEffect(() => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    autosaveNoteIdRef.current = selectedNote?.id ?? null;

    if (!selectedNote) {
      setDraftTitle("");
      setDraftBody("");
      setIsDirty(false);
      return;
    }

    // TODO: Consider prompting to save/discard when switching notes while isDirty is true.
    setDraftTitle(selectedNote.title ?? "");
    setDraftBody(selectedNote.body ?? "");
    setIsDirty(false);
  }, [selectedNote?.id]); // only on selection changes

  const scheduleAutosave = () => {
    if (!selectedNote) return;

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    const noteIdForTimer = selectedNote.id;
    autosaveNoteIdRef.current = noteIdForTimer;

    autosaveTimerRef.current = window.setTimeout(() => {
      // Guard against stale timer: only save if selection hasn't changed.
      if (autosaveNoteIdRef.current !== noteIdForTimer) return;
      handleSave({ silent: true, noteIdOverride: noteIdForTimer });
    }, 700);
  };

  const handleCreate = async () => {
    try {
      const created = await notesService.createNote({
        title: "Untitled note",
        body: "",
      });
      await loadNotes();
      if (created?.id) setSelectedId(created.id);
      pushToast({ kind: "success", title: "Created", message: "New note created." });
    } catch (e) {
      pushToast({
        kind: "danger",
        title: "Create failed",
        message: e?.message || "Could not create note.",
      });
    }
  };

  const handleSelect = (id) => {
    // TODO: If isDirty, consider warning before switching to another note.
    setSelectedId(id);
  };

  const handleClearSelection = () => {
    // TODO: If isDirty, consider warning before closing the editor.
    setSelectedId(null);
  };

  const handleDelete = async (id) => {
    const note = notes.find((n) => n.id === id);
    const ok = window.confirm(
      `Delete "${note?.title?.trim() || "Untitled note"}"? This cannot be undone.`
    );
    if (!ok) return;

    try {
      await notesService.deleteNote(id);
      await loadNotes();
      if (selectedId === id) setSelectedId(null);
      pushToast({ kind: "danger", title: "Deleted", message: "Note deleted." });
    } catch (e) {
      pushToast({
        kind: "danger",
        title: "Delete failed",
        message: e?.message || "Could not delete note.",
      });
    }
  };

  const handleSave = async ({ silent, noteIdOverride } = { silent: false }) => {
    const note = selectedNote;
    const noteId = noteIdOverride || note?.id;

    // Ensure we never attempt to save without a valid note id.
    if (!note || !noteId) return;

    const trimmedTitle = (draftTitle || "").trim();
    const titleToSave = trimmedTitle.length ? trimmedTitle : "Untitled note";

    // Avoid needless writes when nothing changed
    if (
      titleToSave === (note.title ?? "") &&
      (draftBody ?? "") === (note.body ?? "")
    ) {
      setIsDirty(false);
      if (!silent) pushToast({ kind: "info", title: "Saved", message: "No changes to save." });
      return;
    }

    try {
      const updated = await notesService.updateNote(noteId, {
        title: titleToSave,
        body: draftBody ?? "",
      });

      // Only apply update if we're still viewing the same note.
      setNotes((prev) =>
        prev.map((n) => (n.id === updated?.id ? updated : n))
      );
      setIsDirty(false);
      if (!silent) pushToast({ kind: "success", title: "Saved", message: "Your note is saved." });
    } catch (e) {
      pushToast({
        kind: "danger",
        title: "Save failed",
        message: e?.message || "Could not save note.",
      });
    }
  };

  // Keyboard UX
  useHotkeys({
    onSave: () => handleSave({ silent: false }),
    onEscape: () => handleClearSelection(),
  });

  const lastUpdatedLabel = selectedNote
    ? formatRelativeTime(selectedNote.updatedAt)
    : null;

  const storageModeLabel = notesService.mode === "api" ? "API" : "Local";

  return (
    <div className="App">
      <Header
        modeLabel={storageModeLabel}
        selectedLastUpdated={lastUpdatedLabel}
        hasSelection={Boolean(selectedNote)}
      />

      <main className="appShell">
        <Sidebar
          notes={filteredNotes}
          selectedId={selectedId}
          query={query}
          onQueryChange={setQuery}
          onCreate={handleCreate}
          onSelect={handleSelect}
          onDelete={handleDelete}
        />

        <section className="mainPanel" aria-label="Note editor panel">
          {!selectedNote ? (
            <div className="emptyState">
              <div className="emptyCard">
                <div className="emptyTitle">Select a note</div>
                <div className="emptyBody">
                  Create a new note or pick one from the sidebar to start editing.
                </div>
                <button className="btn primary" onClick={handleCreate} type="button">
                  Create note
                </button>
              </div>
            </div>
          ) : (
            <Editor
              noteId={selectedNote.id}
              title={draftTitle}
              body={draftBody}
              isDirty={isDirty}
              updatedAt={selectedNote.updatedAt}
              onTitleChange={(v) => {
                setDraftTitle(v);
                setIsDirty(true);
                scheduleAutosave();
              }}
              onBodyChange={(v) => {
                setDraftBody(v);
                setIsDirty(true);
                scheduleAutosave();
              }}
              onSave={() => handleSave({ silent: false })}
              onEnterInTitleFocusBody
              onClearSelection={handleClearSelection}
            />
          )}
        </section>
      </main>

      <ToastViewport toasts={toasts} />
    </div>
  );
}

export default App;
