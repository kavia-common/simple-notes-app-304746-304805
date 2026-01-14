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
 * Hardening notes:
 * - Defensive error handling across list/create/update/delete with user-facing toasts
 * - Avoid losing drafts/selection on transient failures
 * - Autosave timers are always cleared/reset on selection changes and deletions
 * - Stale autosaves are prevented from saving into the wrong note after switching
 */
// PUBLIC_INTERFACE
function App() {
  const notesService = useNotesService();

  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [toasts, setToasts] = useState([]);

  // Draft state for editor (source of truth for user input while editing)
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

  const clearAutosaveTimer = () => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  };

  const scheduleAutosave = () => {
    if (!selectedNote) return;

    clearAutosaveTimer();

    const noteIdForTimer = selectedNote.id;
    autosaveNoteIdRef.current = noteIdForTimer;

    autosaveTimerRef.current = window.setTimeout(() => {
      // Guard against stale timer: only save if selection hasn't changed.
      if (autosaveNoteIdRef.current !== noteIdForTimer) return;
      handleSave({ silent: true, noteIdOverride: noteIdForTimer });
    }, 700);
  };

  const loadNotes = async ({ preserveOnFailure } = { preserveOnFailure: true }) => {
    try {
      const list = await notesService.listNotes();
      const nextNotes = Array.isArray(list) ? list : [];
      setNotes(nextNotes);

      // If selected note disappeared (e.g., deleted elsewhere), clear selection gracefully.
      if (selectedId && !nextNotes.some((n) => n.id === selectedId)) {
        setSelectedId(null);
      }
    } catch (e) {
      pushToast({
        kind: "danger",
        title: "Load failed",
        message: e?.message || "Could not load notes.",
      });

      // On transient failures, keep current notes/selection/draft to avoid losing user input.
      if (!preserveOnFailure) {
        setNotes([]);
        setSelectedId(null);
      }
    }
  };

  useEffect(() => {
    loadNotes({ preserveOnFailure: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesService]);

  // When selection changes, cancel any pending autosave and sync draft from the selected note.
  useEffect(() => {
    clearAutosaveTimer();
    autosaveNoteIdRef.current = selectedNote?.id ?? null;

    if (!selectedNote) {
      setDraftTitle("");
      setDraftBody("");
      setIsDirty(false);
      return;
    }

    // If we are switching to a different note, we currently reset the draft.
    // (If desired, a future step can add a "save/discard changes?" prompt when isDirty is true.)
    setDraftTitle(selectedNote.title ?? "");
    setDraftBody(selectedNote.body ?? "");
    setIsDirty(false);
  }, [selectedNote?.id]); // only on selection changes

  const handleCreate = async () => {
    try {
      const created = await notesService.createNote({
        title: "Untitled note",
        body: "",
      });

      // Prefer optimistic insert to avoid losing selection if list reload fails.
      if (created?.id) {
        setNotes((prev) => {
          const existing = prev.some((n) => n.id === created.id);
          return existing ? prev : [created, ...prev];
        });
        setSelectedId(created.id);
      }

      // Best-effort refresh to align with source-of-truth ordering/shape.
      await loadNotes({ preserveOnFailure: true });

      pushToast({ kind: "success", title: "Created", message: "New note created." });
    } catch (e) {
      pushToast({
        kind: "danger",
        title: "Create failed",
        message: e?.message || "Could not create note.",
      });
      // Preserve draft/selection; no state reset here.
    }
  };

  const handleSelect = (id) => {
    // Cancel any pending autosave for the previously selected note immediately.
    // This avoids a save racing after selection changes.
    clearAutosaveTimer();
    autosaveNoteIdRef.current = String(id);
    setSelectedId(id);
  };

  const handleClearSelection = () => {
    clearAutosaveTimer();
    autosaveNoteIdRef.current = null;
    setSelectedId(null);
  };

  const computeNextSelectionAfterDelete = (deletedId) => {
    const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
    const remaining = sorted.filter((n) => n.id !== deletedId);
    return remaining.length ? remaining[0].id : null;
  };

  const handleDelete = async (id) => {
    const note = notes.find((n) => n.id === id);
    const ok = window.confirm(
      `Delete "${note?.title?.trim() || "Untitled note"}"? This cannot be undone.`
    );
    if (!ok) return;

    const deletingSelected = selectedId === id;
    const nextSelection = deletingSelected ? computeNextSelectionAfterDelete(id) : selectedId;

    // Cancel autosaves immediately so a pending save doesn't fire after deletion.
    if (deletingSelected) {
      clearAutosaveTimer();
      autosaveNoteIdRef.current = null;
    }

    try {
      await notesService.deleteNote(id);

      // Optimistically update list immediately for snappy UI.
      setNotes((prev) => prev.filter((n) => n.id !== id));

      if (deletingSelected) {
        setSelectedId(nextSelection);
      }

      // Best-effort refresh to reconcile with backend/storage.
      await loadNotes({ preserveOnFailure: true });

      pushToast({ kind: "danger", title: "Deleted", message: "Note deleted." });
    } catch (e) {
      pushToast({
        kind: "danger",
        title: "Delete failed",
        message: e?.message || "Could not delete note.",
      });

      // If delete failed, do NOT clear selection or drafts.
      // Attempt to refresh list (best-effort) without wiping current UI state.
      await loadNotes({ preserveOnFailure: true });
    }
  };

  const handleSave = async ({ silent, noteIdOverride } = { silent: false }) => {
    const note = selectedNote;
    const noteId = noteIdOverride || note?.id;

    // Ensure we never attempt to save without a valid note id.
    if (!note || !noteId) return;

    // Guard against stale saves: if caller provided an override and selection changed, don't save.
    if (noteIdOverride && selectedId !== noteIdOverride) return;

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

      // Only apply update if we're still viewing the same note id.
      setNotes((prev) => prev.map((n) => (n.id === updated?.id ? updated : n)));

      // Also keep selection stable (should already be), and clear dirty state on success.
      setIsDirty(false);
      if (!silent) pushToast({ kind: "success", title: "Saved", message: "Your note is saved." });
    } catch (e) {
      // Preserve draft content and selection on failure.
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

  const lastUpdatedLabel = selectedNote ? formatRelativeTime(selectedNote.updatedAt) : null;
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
