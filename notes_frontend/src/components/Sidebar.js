import React from "react";
import NoteItem from "./NoteItem";

/**
 * Sidebar with search/filter, create button, and notes list.
 */
// PUBLIC_INTERFACE
export default function Sidebar({
  notes,
  selectedId,
  query,
  onQueryChange,
  onCreate,
  onSelect,
  onDelete,
}) {
  return (
    <aside className="sidebar" aria-label="Notes sidebar">
      <div className="sidebarTop">
        <div className="sidebarActions">
          <button className="btn primary" onClick={onCreate} type="button">
            + New
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
            title="Clear search"
          >
            Clear
          </button>
        </div>

        <input
          className="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search notes…"
          aria-label="Search notes"
        />
      </div>

      <div className="notesList" role="list">
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
              onSelect={() => onSelect(n.id)}
              onDelete={() => onDelete(n.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
