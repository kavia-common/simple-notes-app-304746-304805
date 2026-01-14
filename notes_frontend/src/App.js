import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Editor from "./components/Editor";
import ToastViewport from "./components/ToastViewport";
import { useNotesService } from "./hooks/useNotesService";
import { useHotkeys } from "./hooks/useHotkeys";
import { formatRelativeTime } from "./utils/date";
import { loadJson, saveJson } from "./utils/storage";
import { normalizeNote } from "./utils/note";

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

  const PREFS_KEY = "notes.prefs.v1";

  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState("updated_desc"); // updated_desc | title_asc
  const [toasts, setToasts] = useState([]);

  // Draft state for editor (source of truth for user input while editing)
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const autosaveTimerRef = useRef(null);

  // Tracks the note id that the current autosave timer was scheduled for.
  // Prevents a stale timer from saving to the wrong note after selection changes.
  const autosaveNoteIdRef = useRef(null);

  // Sidebar keyboard UX: keep an "active" (highlighted) id separate from selected id.
  const [activeSidebarId, setActiveSidebarId] = useState(null);

  // Restore prefs (search query + sort mode) once on mount.
  useEffect(() => {
    const prefs = loadJson(PREFS_KEY, {});
    const nextQuery = typeof prefs?.query === "string" ? prefs.query : "";
    const nextSortMode =
      prefs?.sortMode === "updated_desc" || prefs?.sortMode === "title_asc"
        ? prefs.sortMode
        : "updated_desc";

    setQuery(nextQuery);
    setSortMode(nextSortMode);
    // If a user had a search query, the list will filter on first render naturally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist prefs on change (kept small and versioned).
  useEffect(() => {
    saveJson(PREFS_KEY, { query, sortMode });
  }, [query, sortMode]);

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedId) || null,
    [notes, selectedId]
  );

  const sortedNotes = useMemo(() => {
    const list = [...notes];

    if (sortMode === "title_asc") {
      return list.sort((a, b) => {
        const ta = (a.title || "").trim().toLowerCase() || "untitled note";
        const tb = (b.title || "").trim().toLowerCase() || "untitled note";
        if (ta < tb) return -1;
        if (ta > tb) return 1;
        // Stable tie-breaker: updated desc
        return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
      });
    }

    // Default: updated desc
    return list.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }, [notes, sortMode]);

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedNotes;
    return sortedNotes.filter((n) => {
      const t = (n.title || "").toLowerCase();
      const b = (n.body || "").toLowerCase();
      return t.includes(q) || b.includes(q);
    });
  }, [sortedNotes, query]);

  // Keep activeSidebarId coherent with current list + selection.
  useEffect(() => {
    // Prefer keeping the current selection active if it's in the filtered list.
    if (selectedId && filteredNotes.some((n) => n.id === selectedId)) {
      setActiveSidebarId(selectedId);
      return;
    }
    // Otherwise, keep existing active if still present.
    if (activeSidebarId && filteredNotes.some((n) => n.id === activeSidebarId)) {
      return;
    }
    // Otherwise, fall back to first visible note.
    setActiveSidebarId(filteredNotes[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredNotes, selectedId]);

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
    setActiveSidebarId(String(id));
  };

  const handleClearSelection = () => {
    clearAutosaveTimer();
    autosaveNoteIdRef.current = null;
    setSelectedId(null);
  };

  const computeNextSelectionAfterDelete = (deletedId) => {
    const remaining = filteredNotes.filter((n) => n.id !== deletedId);
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
    if (titleToSave === (note.title ?? "") && (draftBody ?? "") === (note.body ?? "")) {
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

  const handleDuplicate = async () => {
    if (!selectedNote) return;
    try {
      const baseTitle = (selectedNote.title || "").trim() || "Untitled note";
      const copyTitle = `${baseTitle} (Copy)`;
      const created = await notesService.createNote({
        title: copyTitle,
        body: selectedNote.body ?? "",
      });

      if (created?.id) {
        setNotes((prev) => {
          const existing = prev.some((n) => n.id === created.id);
          return existing ? prev : [created, ...prev];
        });
        setSelectedId(created.id);
        setActiveSidebarId(created.id);
      }

      await loadNotes({ preserveOnFailure: true });

      pushToast({ kind: "success", title: "Duplicated", message: "Note duplicated." });
    } catch (e) {
      pushToast({
        kind: "danger",
        title: "Duplicate failed",
        message: e?.message || "Could not duplicate note.",
      });
    }
  };

  const handleToggleSort = () => {
    setSortMode((prev) => {
      const next = prev === "updated_desc" ? "title_asc" : "updated_desc";
      pushToast({
        kind: "info",
        title: "Sort",
        message: next === "updated_desc" ? "Sorting by Updated (desc)." : "Sorting by Title (A→Z).",
      });
      return next;
    });
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
          activeId={activeSidebarId}
          query={query}
          sortMode={sortMode}
          onQueryChange={setQuery}
          onToggleSort={handleToggleSort}
          onCreate={handleCreate}
          onSelect={handleSelect}
          onDelete={handleDelete}
          onActiveChange={setActiveSidebarId}
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
              createdAt={selectedNote.createdAt}
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
              onDuplicate={handleDuplicate}
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
