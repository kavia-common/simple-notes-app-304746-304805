import React, { useEffect, useMemo, useRef, useState } from "react";
import NoteItem from "./NoteItem";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

/**
 * Sidebar with search/filter, create button, and notes list.
 */
// PUBLIC_INTERFACE
export default function Sidebar({
  notes,
  selectedId,
  activeId,
  query,
  sortMode,
  onQueryChange,
  onToggleSort,
  onCreate,
  onSelect,
  onDelete,
  onActiveChange,
}) {
  const listRef = useRef(null);

  // Local (immediate) input state for responsive typing; app-level filtering is debounced.
  const [localQuery, setLocalQuery] = useState(query ?? "");
  useEffect(() => setLocalQuery(query ?? ""), [query]);

  const debouncedQuery = useDebouncedValue(localQuery, 200);
  useEffect(() => {
    // Only propagate when the debounced value changes.
    onQueryChange?.(debouncedQuery);
  }, [debouncedQuery, onQueryChange]);

  const idToIndex = useMemo(() => {
    const map = new Map();
    notes.forEach((n, idx) => map.set(n.id, idx));
    return map;
  }, [notes]);

  useEffect(() => {
    // Ensure the active item stays visible when keyboard navigating.
    if (!activeId) return;
    const el = listRef.current?.querySelector(`[data-note-id="${CSS.escape(String(activeId))}"]`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  const sortLabel = sortMode === "title_asc" ? "Title (A→Z)" : "Updated (desc)";

  const handleListKeyDown = (e) => {
    if (notes.length === 0) return;

    // Only handle navigation keys; allow others to bubble.
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") return;

    // Avoid page scroll from arrow keys.
    e.preventDefault();

    const currentId = activeId ?? selectedId ?? notes[0].id;
    const currentIdx = idToIndex.get(currentId);
    const safeIdx = typeof currentIdx === "number" ? currentIdx : 0;

    if (e.key === "Enter") {
      onSelect(notes[safeIdx].id);
      return;
    }

    const delta = e.key === "ArrowDown" ? 1 : -1;
    const nextIdx = Math.min(notes.length - 1, Math.max(0, safeIdx + delta));
    const nextId = notes[nextIdx].id;
    onActiveChange?.(nextId);
  };

  return (
    <aside className="sidebar" aria-label="Notes sidebar">
      <div className="sidebarTop">
        <div className="sidebarActions">
          <button className="btn primary" onClick={onCreate} type="button" aria-label="Create note">
            + New
          </button>

          <button
            className="btn"
            type="button"
            onClick={onToggleSort}
            aria-label="Toggle sort mode"
            title="Toggle sort mode"
          >
            Sort: {sortLabel}
          </button>

          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              setLocalQuery("");
              onQueryChange?.("");
            }}
            aria-label="Clear search"
            title="Clear search"
          >
            Clear
          </button>
        </div>

        <input
          className="search"
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          placeholder="Search notes…"
          aria-label="Search notes"
        />
      </div>

      <div
        ref={listRef}
        className="notesList"
        role="list"
        tabIndex={0}
        aria-label="Notes list"
        onKeyDown={handleListKeyDown}
      >
        {notes.length === 0 ? (
          <div style={{ padding: 10, color: "rgba(17, 24, 39, 0.64)", fontSize: 13 }}>
            No notes found.
          </div>
        ) : (
          notes.map((n) => (
            <NoteItem
              key={n.id}
              note={n}
              selected={n.id === selectedId}
              active={n.id === activeId}
              onSelect={() => onSelect(n.id)}
              onDelete={() => onDelete(n.id)}
              onActive={() => onActiveChange?.(n.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
