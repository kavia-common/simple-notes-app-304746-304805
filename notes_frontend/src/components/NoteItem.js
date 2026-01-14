import React from "react";
import { formatRelativeTime } from "../utils/date";

/**
 * Single row in the notes list.
 */
// PUBLIC_INTERFACE
export default function NoteItem({ note, selected, onSelect, onDelete }) {
  const snippet = (note.body || "").replace(/\s+/g, " ").trim().slice(0, 60);
  const title = (note.title || "").trim() || "Untitled note";

  return (
    <div
      role="listitem"
      className={`noteItem ${selected ? "selected" : ""}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      tabIndex={0}
      aria-label={`Note: ${title}`}
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
