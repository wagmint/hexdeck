/**
 * Format milliseconds into compact human-readable units for UI copy.
 * < 60m => Xm, < 24h => Xh, >= 24h => Xd
 */
export function formatIdleDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes >= 24 * 60) {
    const days = Math.round(minutes / (24 * 60));
    return `${days}d`;
  }
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60);
    return `${hours}h`;
  }
  return `${minutes}m`;
}
