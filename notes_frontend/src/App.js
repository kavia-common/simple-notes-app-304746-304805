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
    const list = await notesService.listNotes();
    setNotes(list);
    // Keep selection stable if possible
    if (selectedId && !list.some((n) => n.id === selectedId)) {
      setSelectedId(null);
    }
  };

  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesService]);

  // When selection changes, sync draft from note
  useEffect(() => {
    if (!selectedNote) {
      setDraftTitle("");
      setDraftBody("");
      setIsDirty(false);
      return;
    }
    setDraftTitle(selectedNote.title ?? "");
    setDraftBody(selectedNote.body ?? "");
    setIsDirty(false);
  }, [selectedNote?.id]); // only on selection changes

  const scheduleAutosave = () => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = window.setTimeout(() => {
      handleSave({ silent: true });
    }, 700);
  };

  const handleCreate = async () => {
    const created = await notesService.createNote({
      title: "Untitled note",
      body: "",
    });
    await loadNotes();
    setSelectedId(created.id);
    pushToast({ kind: "success", title: "Created", message: "New note created." });
  };

  const handleSelect = (id) => {
    setSelectedId(id);
  };

  const handleClearSelection = () => {
    setSelectedId(null);
  };

  const handleDelete = async (id) => {
    const note = notes.find((n) => n.id === id);
    const ok = window.confirm(
      `Delete "${note?.title?.trim() || "Untitled note"}"? This cannot be undone.`
    );
    if (!ok) return;
    await notesService.deleteNote(id);
    await loadNotes();
    if (selectedId === id) setSelectedId(null);
    pushToast({ kind: "danger", title: "Deleted", message: "Note deleted." });
  };

  const handleSave = async ({ silent } = { silent: false }) => {
    if (!selectedNote) return;
    const trimmedTitle = (draftTitle || "").trim();
    const titleToSave = trimmedTitle.length ? trimmedTitle : "Untitled note";

    // Avoid needless writes when nothing changed
    if (
      titleToSave === (selectedNote.title ?? "") &&
      (draftBody ?? "") === (selectedNote.body ?? "")
    ) {
      setIsDirty(false);
      if (!silent) pushToast({ kind: "info", title: "Saved", message: "No changes to save." });
      return;
    }

    const updated = await notesService.updateNote(selectedNote.id, {
      title: titleToSave,
      body: draftBody ?? "",
    });

    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    setIsDirty(false);
    if (!silent) pushToast({ kind: "success", title: "Saved", message: "Your note is saved." });
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
                <button className="btn primary" onClick={handleCreate}>
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
