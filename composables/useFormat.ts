export function formatBytes(n?: number | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatRelativeTime(ms?: number | null): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const now = Date.now();
  const diff = Math.abs(now - ms);
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} h ago`;
  return d.toLocaleString();
}

/** Format a duration in seconds as a compact human string ("47h 12m", "3m 14s"). */
export function formatDuration(seconds?: number | null): string {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds) || seconds < 0) {
    return "—";
  }
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const totalMinutes = Math.floor(seconds / 60);
  const remSec = Math.round(seconds % 60);
  if (totalMinutes < 60) {
    return remSec ? `${totalMinutes}m ${remSec}s` : `${totalMinutes}m`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const remMin = totalMinutes % 60;
  return remMin ? `${hours}h ${remMin}m` : `${hours}h`;
}

/** "2 days ago", "yesterday", "today", etc. for an ISO timestamp. */
export function formatRelativeIso(iso?: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return formatRelativeTime(ms);
}
