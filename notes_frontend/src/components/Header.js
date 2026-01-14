import React, { useRef } from "react";

/**
 * App header/top bar with subtle gradient accent and status badges.
 */
// PUBLIC_INTERFACE
export default function Header({
  modeLabel,
  selectedLastUpdated,
  hasSelection,
  onDownloadJson,
  onImportFile,
}) {
  const fileInputRef = useRef(null);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <header className="appHeader">
      <div className="topBarAccent" />
      <div className="headerInner">
        <div className="brand" aria-label="App brand">
          <div className="brandMark" aria-hidden="true" />
          <div className="brandText">
            <div className="brandTitle">Simple Notes</div>
            <div className="brandSub">Ocean Professional</div>
          </div>
        </div>

        <div className="headerMeta">
          <div className="badge" title="Storage mode">
            <span className={`badgeDot ${modeLabel === "API" ? "" : "amber"}`} />
            Mode: <strong style={{ color: "rgba(17,24,39,0.9)" }}>{modeLabel}</strong>
          </div>

          {hasSelection && (
            <div className="badge" title="Selected note last updated">
              <span className="badgeDot" />
              Updated:{" "}
              <strong style={{ color: "rgba(17,24,39,0.9)" }}>{selectedLastUpdated}</strong>
            </div>
          )}

          <div className="headerActions" aria-label="Export and import">
            <button
              className="btn"
              type="button"
              onClick={onDownloadJson}
              aria-label="Download notes as JSON"
              title="Download notes as JSON"
            >
              Download JSON
            </button>

            <input
              ref={fileInputRef}
              className="fileInput"
              type="file"
              accept="application/json"
              aria-label="Import notes from JSON file"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (file) onImportFile?.(file);
                // Allow importing the same file twice in a row.
                e.target.value = "";
              }}
            />

            <button
              className="btn ghost"
              type="button"
              onClick={openFilePicker}
              aria-label="Import notes from file"
              title="Import notes from file"
            >
              Import
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
