/**
 * Human-friendly relative time without external deps.
 */
// PUBLIC_INTERFACE
export function formatRelativeTime(epochMs) {
  const t = typeof epochMs === "number" ? epochMs : Date.now();
  const diff = Date.now() - t;

  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;

  return new Date(t).toLocaleString();
}
