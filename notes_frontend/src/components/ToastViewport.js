import React from "react";

/**
 * Toast viewport for lightweight snackbars.
 *
 * Toast shape (backwards compatible):
 * {
 *   id: string,
 *   kind?: "info" | "success" | "danger",
 *   title: string,
 *   message: string,
 *   durationMs?: number,
 *   action?: { label: string, onClick: () => void, ariaLabel?: string }
 * }
 */
// PUBLIC_INTERFACE
export default function ToastViewport({ toasts }) {
  return (
    <div className="toastViewport" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind || "info"}`} role="status">
          <div className="toastTopRow">
            <div style={{ minWidth: 0 }}>
              <div className="toastTitle">{t.title}</div>
              <div className="toastMsg">{t.message}</div>
            </div>

            {t.action?.label ? (
              <button
                className="toastAction"
                type="button"
                onClick={t.action.onClick}
                aria-label={t.action.ariaLabel || t.action.label}
                title={t.action.label}
              >
                {t.action.label}
              </button>
            ) : null}
          </div>

          <div className="toastBar" aria-hidden="true">
            <div />
          </div>
        </div>
      ))}
    </div>
  );
}
