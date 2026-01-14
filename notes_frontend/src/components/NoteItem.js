import React, { memo, useMemo } from "react";
import { formatRelativeTime } from "../utils/date";

/**
 * Single row in the notes list.
 */
// PUBLIC_INTERFACE
function NoteItemImpl({ note, selected, active, onSelect, onDelete, onActive }) {
  const title = useMemo(() => (note.title || "").trim() || "Untitled note", [note.title]);
  const snippet = useMemo(
    () => (note.body || "").replace(/\s+/g, " ").trim().slice(0, 60),
    [note.body]
  );

  return (
    <div
      role="listitem"
      className={`noteItem ${selected ? "selected" : ""} ${active ? "active" : ""}`}
      onClick={onSelect}
      onFocus={onActive}
      onMouseEnter={onActive}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onSelect();
        }
        if (e.key === " ") {
          // Prevent page scroll when using Space to activate.
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      aria-label={`Note: ${title}`}
      data-note-id={note.id}
    >
      <div style={{ minWidth: 0 }}>
        <div className="noteTitle">{title}</div>
        <div className="noteSnippet">{snippet || "No content yet…"}</div>
        <div className="noteMeta">Updated {formatRelativeTime(note.updatedAt)}</div>
      </div>

      <button
        className="iconBtn danger"
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Delete note"
        title="Delete"
      >
        Delete
      </button>
    </div>
  );
}

// PUBLIC_INTERFACE
const NoteItem = memo(NoteItemImpl);
export default NoteItem;
