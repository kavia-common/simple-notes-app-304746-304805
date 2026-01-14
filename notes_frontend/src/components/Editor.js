import React, { memo, useMemo, useRef } from "react";
import { formatRelativeTime } from "../utils/date";

/**
 * Editor for selected note.
 */
// PUBLIC_INTERFACE
function EditorImpl({
  noteId,
  title,
  body,
  isDirty,
  createdAt,
  updatedAt,
  onTitleChange,
  onBodyChange,
  onSave,
  onDuplicate,
  onEnterInTitleFocusBody,
  onClearSelection,
}) {
  const bodyRef = useRef(null);

  const counts = useMemo(() => {
    const text = String(body ?? "");
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return { chars, words };
  }, [body]);

  const selectionInfo = () => {
    const el = bodyRef.current;
    if (!el) return null;
    return {
      start: el.selectionStart ?? 0,
      end: el.selectionEnd ?? 0,
      value: el.value ?? "",
    };
  };

  const applyWrap = (prefix, suffix = prefix) => {
    const info = selectionInfo();
    if (!info) return;

    const { start, end, value } = info;
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);

    const next = `${before}${prefix}${selected}${suffix}${after}`;
    onBodyChange(next);

    // Restore focus and place cursor inside inserted formatting.
    window.requestAnimationFrame(() => {
      const el = bodyRef.current;
      if (!el) return;
      el.focus();

      const cursorStart = start + prefix.length;
      const cursorEnd = end + prefix.length;
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const applyHeading = (level) => {
    const info = selectionInfo();
    if (!info) return;

    const { start, end, value } = info;

    // Apply heading to the line containing selectionStart.
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEndIdx = value.indexOf("\n", end);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;

    const line = value.slice(lineStart, lineEnd);
    const trimmed = line.replace(/^#{1,6}\s+/, ""); // remove existing heading
    const prefix = `${"#".repeat(Math.min(6, Math.max(1, level)))} `;

    const next = `${value.slice(0, lineStart)}${prefix}${trimmed}${value.slice(lineEnd)}`;
    onBodyChange(next);

    window.requestAnimationFrame(() => {
      const el = bodyRef.current;
      if (!el) return;
      el.focus();
      // Keep cursor near original selection, offset by possible heading changes.
      const nextPos = Math.min(next.length, start + prefix.length);
      el.setSelectionRange(nextPos, nextPos);
    });
  };

  const metaTitle = `Created: ${new Date(createdAt ?? Date.now()).toLocaleString()}\nUpdated: ${new Date(
    updatedAt ?? Date.now()
  ).toLocaleString()}`;

  return (
    <>
      <div className="editorTop">
        <div className="editorMeta">
          <div className="editorHint">Tip: Ctrl/Cmd+S to save • Esc to close</div>
          <div className="editorStatus">
            <span title={metaTitle}>
              Updated <strong>{formatRelativeTime(updatedAt)}</strong>
            </span>
            {isDirty ? " • Unsaved changes" : " • Saved"}
            <span className="editorSubMeta"> • Created {formatRelativeTime(createdAt)}</span>
          </div>
        </div>

        <div className="editorActions">
          <button
            className="btn"
            type="button"
            onClick={onDuplicate}
            aria-label="Duplicate note"
            title="Duplicate note"
          >
            Duplicate
          </button>

          <button className="btn ghost" type="button" onClick={onClearSelection} aria-label="Close">
            Close
          </button>
          <button className="btn primary" type="button" onClick={onSave} aria-label="Save">
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

        <div className="formatBar" role="toolbar" aria-label="Formatting toolbar">
          <button
            className="formatBtn"
            type="button"
            onClick={() => applyWrap("**")}
            aria-label="Bold"
            title="Bold"
          >
            B
          </button>
          <button
            className="formatBtn"
            type="button"
            onClick={() => applyWrap("_")}
            aria-label="Italic"
            title="Italic"
          >
            I
          </button>
          <button
            className="formatBtn"
            type="button"
            onClick={() => applyHeading(1)}
            aria-label="Heading"
            title="Heading"
          >
            H1
          </button>
        </div>

        <textarea
          ref={bodyRef}
          className="textarea"
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder="Write your note…"
          aria-label="Note body"
        />

        <div className="editorCounts" aria-label="Editor statistics">
          {counts.words} words • {counts.chars} characters
        </div>
      </div>
    </>
  );
}

// Memo: editor should only rerender when its props change (not on sidebar search/sort updates).
// PUBLIC_INTERFACE
const Editor = memo(EditorImpl, (prev, next) => {
  return (
    prev.noteId === next.noteId &&
    prev.title === next.title &&
    prev.body === next.body &&
    prev.isDirty === next.isDirty &&
    prev.createdAt === next.createdAt &&
    prev.updatedAt === next.updatedAt &&
    prev.onTitleChange === next.onTitleChange &&
    prev.onBodyChange === next.onBodyChange &&
    prev.onSave === next.onSave &&
    prev.onDuplicate === next.onDuplicate &&
    prev.onClearSelection === next.onClearSelection
  );
});

export default Editor;
