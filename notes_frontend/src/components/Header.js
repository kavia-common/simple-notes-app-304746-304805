import React from "react";

/**
 * App header/top bar with subtle gradient accent and status badges.
 */
// PUBLIC_INTERFACE
export default function Header({ modeLabel, selectedLastUpdated, hasSelection }) {
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
              <strong style={{ color: "rgba(17,24,39,0.9)" }}>
                {selectedLastUpdated}
              </strong>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
