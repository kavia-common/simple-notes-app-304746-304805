import React, { useEffect, useRef } from "react";
import { formatRelativeTime } from "../utils/date";

/**
 * Editor for selected note.
 */
// PUBLIC_INTERFACE
export default function Editor({
  noteId,
  title,
  body,
  isDirty,
  updatedAt,
  onTitleChange,
  onBodyChange,
  onSave,
  onEnterInTitleFocusBody,
  onClearSelection,
}) {
  const bodyRef = useRef(null);

  // If note changes, move focus to title by default (nice UX for new notes)
  useEffect(() => {
    // Intentionally not focusing automatically to avoid stealing focus on mobile.
  }, [noteId]);

  return (
    <>
      <div className="editorTop">
        <div className="editorMeta">
          <div className="editorHint">
            Tip: Ctrl/Cmd+S to save • Esc to close
          </div>
          <div className="editorStatus">
            Last updated <strong>{formatRelativeTime(updatedAt)}</strong>
            {isDirty ? " • Unsaved changes" : " • Saved"}
          </div>
        </div>

        <div className="editorActions">
          <button className="btn ghost" type="button" onClick={onClearSelection}>
            Close
          </button>
          <button className="btn primary" type="button" onClick={onSave}>
            Save
          </button>
        </div>
      </div>

      <div className="editorBody">
        <input
          className="inputTitle"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Title"
          aria-label="Note title"
          onKeyDown={(e) => {
            if (e.key === "Enter" && onEnterInTitleFocusBody) {
              e.preventDefault();
              bodyRef.current?.focus();
            }
          }}
        />

        <textarea
          ref={bodyRef}
          className="textarea"
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder="Write your note…"
          aria-label="Note body"
        />
      </div>
    </>
  );
}
