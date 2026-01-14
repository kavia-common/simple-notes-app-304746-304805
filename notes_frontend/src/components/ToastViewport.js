import React from "react";

/**
 * Toast viewport for lightweight snackbars.
 */
// PUBLIC_INTERFACE
export default function ToastViewport({ toasts }) {
  return (
    <div className="toastViewport" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind || "info"}`} role="status">
          <div className="toastTitle">{t.title}</div>
          <div className="toastMsg">{t.message}</div>
          <div className="toastBar" aria-hidden="true">
            <div />
          </div>
        </div>
      ))}
    </div>
  );
}
